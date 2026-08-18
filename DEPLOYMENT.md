# Deploying Kuwana

Container and Kubernetes deployment. The Vercel path (`vercel.json`, Vercel Cron) still works and is
untouched — nothing here replaces it, and `next.config.ts` only switches to standalone output when
`NEXT_OUTPUT_STANDALONE=1`, which the Docker build is the only thing that sets.

| | |
|---|---|
| Images | `ghcr.io/natureaiia/kuwana` (web), `ghcr.io/natureaiia/kuwana-migrate` (migrations) |
| Chart | `deploy/helm/kuwana` |
| Health | `/api/health` (liveness), `/api/health/ready` (readiness — checks Postgres + config) |
| CI | `.github/workflows/ci.yml` |
| Release | `.github/workflows/release.yml` |

## Target architecture

**One privately-hosted VPS running k3s** (single-node Kubernetes) — not a multi-node autoscaled
cluster. Everything stateful this chart deploys lives on that one box:

- **Auth**: Auth.js (NextAuth v5), Credentials + JWT. Entirely self-hosted — no external identity
  provider, so there is no separate auth service to stand up or point at.
- **Storage**: self-hosted MinIO, deployed by this chart (`minio.enabled=true`, the default).
- **Database**: in-cluster Postgres, deployed by this chart (`postgresql.enabled=true`, the
  default). Single instance, no HA — an explicit deferred decision, not a v1 blocker.

Everything below assumes this shape. Section 6 covers what changes if it ever grows past one box.

---

## 1. Local: docker compose

```bash
cp .env.example .env          # fill in Auth.js, MinIO, and Anthropic values
docker compose up --build     # postgres → migrate → web, in that order
docker compose --profile seed up seed   # once: loads sectors, providers, listings
```

App on http://localhost:3000. Postgres is local; **the Claude API is the real hosted service** —
Auth.js (NextAuth v5) is entirely self-hosted (Credentials + JWT, no external identity provider),
so it needs nothing beyond `AUTH_SECRET`. MinIO can be a local container of your own (this compose
file doesn't run one for you) or a real self-hosted instance elsewhere — either way it's not baked
into this stack, unlike Postgres.

`DATABASE_URL` from `.env` is deliberately overridden in `docker-compose.yml` to point at the
`postgres` container.

---

## 2. The images

One Dockerfile, two publishable targets:

```bash
docker build --target runner   -t kuwana:local .
docker build --target migrator -t kuwana-migrate:local .
```

**`runner`** — Next.js standalone server. Non-root (uid 1000), no shell-accessible package manager,
no Prisma CLI, no migrations directory. A web pod cannot alter the schema of the database it is
querying, by construction.

**`migrator`** — `prisma migrate deploy` plus the seed script. Runs as a Helm hook, never as a
long-lived workload.

### No more build-time environment split

Auth.js (`AUTH_URL`/`AUTH_SECRET`) and MinIO (`MINIO_*`) are all **server-only** env — unlike the
old `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values they replace, none of
them are inlined into the client bundle at build time, so they're just runtime Deployment env (see
the chart's ConfigMap/Secret) and never build args. The one remaining build arg is
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, which is genuinely public and still baked in the same way.

That means, unlike before, **the same image can run in staging and production** — there is no
longer an environment-scoped rebuild requirement for auth/storage config.

---

## 3. k3s cluster setup

k3s ships **Traefik** as its default ingress controller. This chart's `templates/ingress.yaml` (and
`templates/minio.yaml`'s Ingress) are written for **nginx-ingress** annotations
(`nginx.ingress.kubernetes.io/*` — proxy body size, read timeout, buffering, rate limiting). Traefik
does not understand those annotations and silently ignores them, so before installing the chart:

```bash
# Disable Traefik at k3s install time (server node):
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable=traefik" sh -

# Then install ingress-nginx the normal way (Helm chart, manifests, whatever
# your provisioning already uses).
```

If k3s is already running with Traefik, remove the `traefik` HelmChart resource k3s installed
(`kubectl -n kube-system delete helmchart traefik`) and install ingress-nginx in its place. Rewriting
this chart's annotations to speak Traefik's dialect is not the fix — the annotations stay
nginx-specific and the infra install order is what has to change.

**NetworkPolicy is documentation here, not enforcement.** k3s's default CNI is Flannel, which does
not implement NetworkPolicy at all — `networkPolicy.enabled=true` (the chart default) still renders
accurate `NetworkPolicy` resources describing the intended traffic shape, but nothing actually blocks
a pod that violates them. Real enforcement needs a policy-aware CNI; Calico is the documented future
hardening path if that's ever needed. This is a stated v1 gap, not something the chart works around.

### Install

```bash
# Secrets first — the chart refuses to render without a source for them.
# MINIO_ACCESS_KEY/MINIO_SECRET_KEY are NOT listed here: with minio.enabled=true
# (the default) the chart generates and owns those itself (see minio.yaml).
kubectl create namespace kuwana
kubectl -n kuwana create secret generic kuwana-app \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-...' \
  --from-literal=CRON_SECRET="$(openssl rand -hex 32)"

helm upgrade --install kuwana deploy/helm/kuwana \
  -n kuwana \
  -f deploy/helm/kuwana/values-production.yaml \
  --set existingSecret=kuwana-app \
  --set externalSecret.enabled=false \
  --set image.digest=sha256:... \
  --set migrations.image.digest=sha256:... \
  --atomic --timeout 10m
```

`--atomic` matters: without it a failed rollout leaves the release half-applied and you have to
work out what state it stopped in.

Deploy by **digest**, not tag. A tag can be moved; a digest is the only reference that guarantees
the bytes running are the bytes that were scanned and signed.

### Verify

```bash
helm test kuwana -n kuwana        # hits /api/health and /api/health/ready through the Service
kubectl -n kuwana rollout status deploy/kuwana
kubectl -n kuwana get pods,pvc,cronjob
```

### What gets created

| Resource | Purpose |
|---|---|
| Deployment | 1 replica by default, rolling update with `maxUnavailable: 0` |
| Postgres StatefulSet | In-cluster database, single instance, PVC-backed |
| MinIO StatefulSet | In-cluster object storage, single instance, PVC-backed |
| Valkey StatefulSet | Shared cache / rate-limit store |
| Service + Ingress | ClusterIP behind nginx, TLS via cert-manager, buffering off for chat streaming |
| MinIO Ingress | Separate public hostname for the S3 API only — see §5 |
| Job (Helm hook) | `prisma migrate deploy` before (or just after, for in-cluster Postgres) the new pods exist |
| CronJobs | `curl` against `/api/cron/*` with the shared `CRON_SECRET` bearer |
| NetworkPolicy | Documents intended traffic shape; not enforced under Flannel — see above |
| ServiceAccount | No RBAC, no mounted token — the app never calls the Kubernetes API |

### Migration ordering

With the in-cluster Postgres (the default, `postgresql.enabled=true`), the migration Job is a
**`post-install,pre-upgrade`** hook, because a pre-install hook would run before the StatefulSet it
needs exists. On a first install the pods simply stay unready until the schema is there — which is
precisely what the readiness probe is for. Upgrades keep the pre-upgrade guarantee.

(Setting `postgresql.enabled=false` to point at an external database instead switches the hook back
to `pre-install,pre-upgrade`: migrate before the new ReplicaSet is created, so code never runs
against a schema it doesn't expect.)

`migrate deploy` only applies committed migration files. `migrate dev` must never appear in a
cluster: it generates migrations and prompts for input.

---

## 4. Secrets

Three sources, in descending order of preference:

1. **`externalSecret.enabled=true`** — External Secrets Operator pulls from Vault/ASM/GSM. The
   production overlay's default. Nothing sensitive touches this repository.
   Caveat: env vars are snapshotted at container start, so a rotation needs a
   `kubectl rollout restart` (or a reloader controller) to take effect.
2. **`existingSecret: <name>`** — a Secret created out of band (sealed-secrets, SOPS, or by hand).
3. **`secrets.create=true`** — values rendered from a values file. **Development only.** Anything
   here is recoverable from `helm get values` and from wherever that file is stored.

`CRON_SECRET` is generated on first install and then read back from the live Secret on upgrade, so
it stays stable — regenerating it every release would break every scheduled job until the next
rollout caught up. MinIO's root credentials (`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`) follow the same
generate-once-and-reuse pattern when `minio.enabled=true`, but as a Secret `minio.yaml` owns
directly — not part of the three sources above at all, unless `minio.enabled=false`, in which case
they fall back to being required in one of the three like everything else.

---

## 5. Database and storage

### Postgres

In-cluster, single instance, deployed by `templates/postgres.yaml` (`postgresql.enabled=true`, the
chart default). Understand what that is before relying on it:

- **One replica. No replication, no failover, no automatic restore.**
- `postgresql.backup.enabled` gives a nightly `pg_dump` to a PVC — a floor, not a backup strategy.
  **A volume in the same cluster does not survive losing the VPS itself.** This is a real, unmade
  decision: nothing in this chart ships dumps off-box today. Before calling the database
  production-grade, decide on and wire up an off-box backup destination (object storage with
  versioning, a second host, whatever fits) — don't assume the on-box PVC backup covers it.
- Restore: `pg_restore --clean --if-exists -d <db> /backup/<file>.dump`, from a pod with the PVC
  mounted.

Connection pooling: the composed in-cluster URL sets a per-pod `connection_limit` (see
`database.connectionLimit` in values.yaml). Postgres' default `max_connections` is 100, raised via
`postgresql.maxConnections`; the chart checks the arithmetic at render time (§6.4) and fails rather
than letting a connection-budget breach be discovered in production. There is no managed pooler
(pgBouncer, port 6543) in this architecture — that advice was specific to a previous
managed-Supabase-database design and doesn't apply once Postgres is in-cluster.

### MinIO

In-cluster, single instance, deployed by `templates/minio.yaml` (`minio.enabled=true`, the chart
default). Two ports, two very different exposure levels:

- **Port 9000 (S3 API) is public**, via its own Ingress (`minio.ingress.*`) on its own hostname
  (`storage.kuwana.example.com` in the production overlay) — separate from the app's own `ingress.*`
  hostname entirely. This is deliberate: browsers load listing images directly from MinIO
  (`MINIO_PUBLIC_URL`), not proxied back through the app, so the S3 API has to be reachable from the
  public internet.
- **Port 9001 (admin console) is cluster-internal only.** No Service exposed outside the cluster, no
  Ingress at all. Reaching it requires `kubectl port-forward` straight to the pod. An admin console
  being reachable from the internet is a materially different risk than a bucket of already-public
  listing images, and this chart does not make that mistake by accident.

Same backup caveat as Postgres applies to the MinIO PVC: it's a floor (survives a pod restart, not a
lost VPS), and shipping bucket contents off-box is not yet wired up here.

---

## 6. Scaling — and re-enabling it

**The default target is one replica on one VPS.** `autoscaling.enabled`, `podDisruptionBudget`, and
`topologySpreadConstraints` are all off/empty by default for exactly that reason — see the comments
in `values.yaml` for the per-setting tradeoffs (a PDB `minAvailable: 50%` on 1 replica blocks every
voluntary eviction forever; a topology spread constraint has nothing to spread across on one node).
Everything below is genuinely still true and still matters even at replicaCount 1 — some of it
(indexes, connection budget) is load-bearing today, some of it (HPA, KEDA, spread constraints) is the
plan for the day this moves past one box.

### 6.1 Database indexes

Migration `20260805110000_add_performance_indexes`. PostgreSQL does not index foreign keys
automatically and Prisma does not add them, so before this every catalog read, every gamification
cooldown check and every "others also compared" lookup was a sequential scan.

The one that mattered most is on `user_events`, which `/api/events` reads on **every** gamified
interaction against an append-only table. Measured on 200k rows:

| | buffers | time |
|---|---|---|
| without the index | 2062, parallel seq scan | 49.7 ms |
| with it | 3, index scan | 0.41 ms |

`comparisons.listing_ids` gets a **GIN** index — the `has` query is an array containment test that
a btree cannot answer at all.

These apply as plain `CREATE INDEX`, which locks each table against writes for the duration.
Correct at today's size (seconds). Once these tables are large, `CREATE INDEX CONCURRENTLY` is
required, and it cannot run inside a transaction — so it has to be applied outside the migration
runner.

### 6.2 A shared cache becomes mandatory above one replica

`unstable_cache` and `revalidateTag` are per process. At replicaCount 1 this is a non-issue — there
is only one process to invalidate. The moment a second replica exists, an admin catalog edit
invalidates the cache on the **one** pod that served the write and leaves the other N−1 serving stale
data until their own TTL expires, and the in-process rate limiter permits limit x replicas requests
instead of limit.

`cache-handler.js` is a Redis-backed incremental-cache handler that fixes both. It engages only
when `REDIS_URL` is set, so `next dev` and Vercel keep the stock behaviour. Every Redis error
degrades to a cache miss — a cache outage must be slower, never an error.

Valkey (`valkey.enabled=true`) stays on by default even at replicaCount 1 — it also survives a pod
restart, which an in-process cache/limiter does not, and keeping it wired in now means raising the
replica count later is a values change, not the day this correctness requirement shows up for the
first time. The chart's render-time check (`_helpers.tpl`) refuses more than one replica without a
shared store (`valkey.enabled` or `externalRedis.enabled`) — that failure is otherwise invisible at
runtime, the app serves happily while silently ignoring invalidations.

### 6.3 Rate limiting

`src/lib/rateLimit.ts` uses `INCR`/`EXPIRE` on the same store, so the limit is enforced across
however many replicas exist. Its failure policy is deliberately the **opposite** of the cache's: a
Redis error falls back to the in-process counter, because degrading to "allow" would silently remove
every spend limit on the Claude routes.

The production overlay still sets `nginx.ingress.kubernetes.io/limit-rps` at the edge — a second,
independent limit that also covers traffic which never reaches a pod.

### 6.4 Connection budget

Prisma opens a pool per process, defaulting to `cpu_count * 2 + 1` — sized for one server. If this
chart is ever scaled past one replica without adjusting `database.connectionLimit`, N replicas each
opening an unbounded pool silently asks for hundreds of connections, and a database refusing
connections looks like a total outage rather than a capacity problem.

    (replica ceiling) × database.connectionLimit + 2  ≤  postgresql.maxConnections

where "replica ceiling" is whichever of `keda.maxReplicaCount`, `autoscaling.maxReplicas`, or plain
`replicaCount` is actually driving the pod count. The chart evaluates that arithmetic at render time
for the in-cluster database and fails with the numbers in the message — there is no managed pooler
to route around in this architecture, unlike the Supabase-backed design this budget check used to
also guard against.

### 6.5 Re-enabling horizontal scaling

Moving past one VPS is the trigger for all of this. In order of how much it's worth doing:

1. **Raise `replicaCount`**, or set `autoscaling.enabled=true` (the HPA block is left in
   `values.yaml`, just disabled, specifically so this is a values change). Turn
   `podDisruptionBudget.enabled` and a real `topologySpreadConstraints` back on in the same change —
   see the comments on each in `values.yaml` for why they're meaningless at replicaCount 1.
2. **Re-check the connection budget** (§6.4) against the new replica ceiling before rolling out —
   the chart will fail the render if it doesn't fit, but it's cheaper to work out ahead of time.
3. **`keda.enabled=true`** swaps the CPU HPA for a KEDA `ScaledObject` driven by ingress-controller
   metrics: requests/second as the primary signal, p95 latency as a backstop, CPU as a floor. CPU is
   a weak proxy here — a pod with 40 requests blocked on Postgres or the Claude API looks nearly idle,
   so a CPU-driven HPA only adds capacity once users are already waiting. Requires KEDA and
   Prometheus scraping ingress-nginx in the (by-then multi-node) cluster. `keda.enabled` and
   `autoscaling.enabled` are mutually exclusive — two controllers on one Deployment fight over the
   replica count, and the chart refuses that combination.

   Honest caveat: the latency trigger does not scale linearly. `ceil(p95 / threshold)` is a blunt
   "things are bad, add some" instruction bounded by `maxReplicaCount`, not a calculation.

## 7. Known gaps, stated rather than hidden

- **Single VPS is a single point of failure for everything stateful.** Losing the node loses
  Postgres, MinIO, and Valkey together — there is no multi-node failover story yet, by design (that
  is the whole point of the current target architecture, not an oversight).
- **No off-box backup destination configured.** `postgresql.backup`/MinIO's own PVC both write to
  volumes in the same cluster. This is a real, currently-unmade decision — see §5.
- **NetworkPolicy is not enforced.** Flannel (k3s's default CNI) does not implement it. The
  resources describe intended traffic, they don't block anything that violates it. Calico is the
  documented path to real enforcement if that's ever needed.
- **No application metrics.** Scaling reads the ingress controller, which cannot see in-flight
  streaming chat connections or event-loop lag. A `/metrics` endpoint would; nothing in the app
  exports one today.
- **Valkey is a single replica with no failover.** Losing it costs a cold cache and a reset
  rate-limit window, both self-healing. It must not start holding anything whose loss is not.
- **The rate-limit window is fixed, not sliding**, so a burst of up to 2× the limit can cross a
  window boundary.
- **ISR/image cache is a per-pod emptyDir.** Irrelevant today (no ISR routes); revisit before
  adding any.
- **No CPU limit** on the web container, deliberately: CFS throttling on Node shows up as latency
  spikes on exactly the SSR and streaming-chat requests that matter. The CPU *request* still
  guarantees the share. Add one if cluster policy requires it.
- **Sector-scanning scripts** (`scripts/social-scan/*`) are not scheduled here. They need a
  Telegram session and were manual-only before this work; scheduling them is a separate decision.

---

## 8. Rollback

```bash
helm rollback kuwana -n kuwana            # previous revision
helm history kuwana -n kuwana
```

Helm rolls back the workload. **It does not roll back a migration** — Prisma's `migrate deploy` is
forward-only. A schema change that the previous image cannot tolerate is therefore a one-way door:
make schema changes backward-compatible (add columns, don't rename or drop in the same release as
the code that stops using them), or accept that rollback means restoring a backup.
