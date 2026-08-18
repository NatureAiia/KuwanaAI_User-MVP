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

## 3. Kubernetes

Requires Kubernetes ≥ 1.27 (`CronJob.timeZone` is used).

### Install

```bash
# Secrets first — the chart refuses to render without a source for them.
kubectl create namespace kuwana
kubectl -n kuwana create secret generic kuwana-app \
  --from-literal=DATABASE_URL='postgresql://...supabase...' \
  --from-literal=AUTH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=MINIO_ACCESS_KEY='...' \
  --from-literal=MINIO_SECRET_KEY='...' \
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
kubectl -n kuwana get hpa,pdb,cronjob
```

### What gets created

| Resource | Purpose |
|---|---|
| Deployment | 3–20 replicas, rolling update with `maxUnavailable: 0` |
| HPA | CPU 65% primary signal, memory 80% as a leak safety net, slow scale-down |
| PodDisruptionBudget | `minAvailable: 50%` — bounds node drains, not node failures |
| Service + Ingress | ClusterIP behind nginx, TLS via cert-manager, buffering off for chat streaming |
| Job (Helm hook) | `prisma migrate deploy` before the new ReplicaSet exists |
| 3 CronJobs | `curl` against `/api/cron/*` with the shared `CRON_SECRET` bearer |
| NetworkPolicy | Ingress from the ingress controller + own jobs; egress to DNS, and the internet **minus RFC1918 and 169.254.0.0/16** |
| ServiceAccount | No RBAC, no mounted token — the app never calls the Kubernetes API |

### Migration ordering

External database (default): the Job is a **`pre-install,pre-upgrade`** hook. Migrations run
before the new pods exist; a failure aborts the release with the old version still serving.

In-cluster Postgres (`postgresql.enabled=true`): the Job is **`post-install,pre-upgrade`**, because
a pre-install hook would run before the StatefulSet it needs exists. On a first install the pods
simply stay unready until the schema is there — which is precisely what the readiness probe is for.
Upgrades keep the pre-upgrade guarantee.

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
rollout caught up.

---

## 5. Database

Production points `DATABASE_URL` at **Supabase**. Supabase is already the auth provider, so running
a second self-managed Postgres in-cluster would add operational burden without removing the
Supabase dependency.

The in-cluster option exists and staging runs it (`postgresql.enabled=true`), which keeps that path
exercised rather than untested-in-theory. Understand what it is before pointing production at it:

- **One replica. No replication, no failover, no point-in-time recovery.**
- `postgresql.backup.enabled` gives a nightly `pg_dump` to a PVC — a floor, not a backup strategy.
  A volume in the same cluster does not survive losing the cluster. Ship dumps to object storage
  with versioning before calling it production-grade.
- Restore: `pg_restore --clean --if-exists -d <db> /backup/<file>.dump`, from a pod with the PVC
  mounted.

Connection pooling: the composed in-cluster URL sets `connection_limit=10` per pod. Postgres'
default `max_connections` is 100, so an autoscaled web tier exhausts connections long before it
exhausts CPU without that. **Against Supabase, use the pooler (pgBouncer) connection string, port
6543, not the direct 5432 one** — the same arithmetic applies, and 20 pods × an unbounded pool will
take the database down.

---

## 6. Scaling

Four things make this fleet actually scale, in order of how badly their absence hurts.

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

### 6.2 A shared cache is mandatory above one replica

`unstable_cache` and `revalidateTag` are per process. With N replicas and no shared store, an admin
catalog edit invalidates the cache on the **one** pod that served the write, and the other N−1 keep
serving stale data until their own TTL expires — while the hit rate sits at roughly 1/N.

`cache-handler.js` is a Redis-backed incremental-cache handler that fixes both. It engages only
when `REDIS_URL` is set, so `next dev` and Vercel keep the stock behaviour. Every Redis error
degrades to a cache miss — a cache outage must be slower, never an error.

The chart **refuses to render** more than one replica without `valkey.enabled` or
`externalRedis.enabled`. That failure is otherwise invisible at runtime: the app serves happily
while silently ignoring invalidations.

### 6.3 Rate limiting

`src/lib/rateLimit.ts` uses `INCR`/`EXPIRE` on the same store, so the limit is enforced across
replicas. Its failure policy is deliberately the **opposite** of the cache's: a Redis error falls
back to the in-process counter, because degrading to "allow" would silently remove every spend
limit on the Claude routes.

The production overlay still sets `nginx.ingress.kubernetes.io/limit-rps` at the edge — a second,
independent limit that also covers traffic which never reaches a pod.

### 6.4 Connection budget

Prisma opens a pool per process, defaulting to `cpu_count * 2 + 1`. That is sized for one server:
at 20 replicas it quietly asks for hundreds of connections, and a database refusing connections
looks like a total outage rather than a capacity problem.

    maxReplicas × database.connectionLimit + 2  ≤  server max_connections

The chart evaluates that at render time for the in-cluster database and fails with the arithmetic
in the message. **Against Supabase, point `DATABASE_URL` at the pooler (pgBouncer, port 6543), not
the direct 5432 endpoint**, and keep `connection_limit` in the URL — the chart cannot check a
managed server's limit for you.

### 6.5 Autoscaling on load, not CPU

`keda.enabled=true` swaps the CPU HPA for a KEDA `ScaledObject` driven by ingress-controller
metrics: requests/second as the primary signal, p95 latency as a backstop, CPU as a floor.

CPU is a weak proxy here — a pod with 40 requests blocked on Supabase or the Claude API looks
nearly idle, so a CPU-driven HPA only adds capacity once users are already waiting. Ingress metrics
also count requests queued *before* they reach a pod, which is exactly the traffic proving more
pods are needed.

Requires KEDA and Prometheus scraping ingress-nginx; off by default so the chart installs on a bare
cluster. `keda.enabled` and `autoscaling.enabled` are mutually exclusive — two controllers on one
Deployment fight over the replica count, and the chart refuses that combination.

Honest caveat: the latency trigger does not scale linearly. `ceil(p95 / threshold)` is a blunt
"things are bad, add some" instruction bounded by `maxReplicaCount`, not a calculation.

## 7. Known gaps, stated rather than hidden

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

## 7. Rollback

```bash
helm rollback kuwana -n kuwana            # previous revision
helm history kuwana -n kuwana
```

Helm rolls back the workload. **It does not roll back a migration** — Prisma's `migrate deploy` is
forward-only. A schema change that the previous image cannot tolerate is therefore a one-way door:
make schema changes backward-compatible (add columns, don't rename or drop in the same release as
the code that stops using them), or accept that rollback means restoring a backup.
