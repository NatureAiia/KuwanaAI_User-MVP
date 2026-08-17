# syntax=docker/dockerfile:1.9
# check=skip=SecretsUsedInArgOrEnv
#
# The skip above is for NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: BuildKit flags
# anything ending in KEY as a secret, but a Supabase *publishable* key is
# designed to be served to browsers and is inlined into the client bundle by
# Next regardless. The service-role key — the one that would matter — is never
# a build arg.
#
# Kuwana — production image.
#
# Two publishable targets share one dependency graph:
#   --target runner    the Next.js server (default)
#   --target migrator  prisma CLI + migrations, run as a pre-upgrade Job
#
# Debian slim rather than Alpine: Prisma's query engine links against glibc +
# OpenSSL 3, and the musl build needs an extra `binaryTargets` entry in
# schema.prisma that would then have to stay correct for every developer's
# machine too. The size difference does not justify that failure mode.

ARG NODE_VERSION=24.13.1

# ---------------------------------------------------------------------------
# base — shared runtime layer
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
# openssl: required by the Prisma query engine. tini: a real init, so a
# SIGTERM from the kubelet reaches the server and zombies get reaped.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — full install (dev deps included; the build needs them)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev

# ---------------------------------------------------------------------------
# builder — prisma generate + next build
# ---------------------------------------------------------------------------
FROM deps AS builder

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they cannot be supplied later by the Deployment's env. That makes the image
# environment-scoped: staging and production need separate builds. Both values
# are public by design (the publishable key is safe in a browser); the service
# role key is NOT among them and is only ever injected at runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# The Turnstile site key is read by a client component, so it has to be here
# rather than in the Deployment's env: supplied only at runtime it inlines as
# undefined, the widget renders nothing, and the deployment looks protected
# while no challenge is ever issued. Optional — unset simply means no widget,
# which is the documented "not configured" state, not a broken build.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=${NEXT_PUBLIC_TURNSTILE_SITE_KEY}

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# `next build` may evaluate modules that construct a PrismaClient. A syntactic
# placeholder satisfies that without any database being reachable — no
# migration or query runs at build time.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    NEXT_OUTPUT_STANDALONE=1 \
    NODE_ENV=production
RUN npm run build

# ---------------------------------------------------------------------------
# runner — the shipped web image
# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

# Runs as the image's existing unprivileged `node` user (uid 1000). The
# Deployment additionally pins runAsUser/runAsNonRoot so a future base-image
# change cannot silently promote this back to root.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# ISR/image-optimizer scratch. Declared so the container still starts with a
# read-only root filesystem, where the pod mounts an emptyDir over it.
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache

USER node
EXPOSE 3000

# Compose and plain-Docker use this; Kubernetes ignores it in favour of the
# probes on /api/health and /api/health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------
# migrate-deps — node_modules with the build-only half removed
# ---------------------------------------------------------------------------
# A separate stage rather than an `rm` in the migrator itself: deleting files
# in a later layer only writes whiteouts, leaving the bytes in the parent
# layer and the pull size unchanged. Pruning here means the migrator's COPY
# transfers the already-trimmed tree.
#
# `npm prune --omit=dev` cannot do this job — tsx, which runs the seed script,
# is itself a dev dependency. What goes is what a migration job never
# executes: Next, React, the bundlers, sharp, the test runner, the linter.
FROM builder AS migrate-deps
RUN rm -rf \
      node_modules/next node_modules/@next \
      node_modules/react node_modules/react-dom \
      node_modules/vite node_modules/vitest node_modules/@vitejs node_modules/@rolldown \
      node_modules/typescript node_modules/@babel \
      node_modules/eslint node_modules/eslint-config-next \
      node_modules/tailwindcss node_modules/@tailwindcss \
      node_modules/lucide-react node_modules/@img node_modules/sharp

# ---------------------------------------------------------------------------
# migrator — schema migrations and seeding, never the web server
# ---------------------------------------------------------------------------
FROM base AS migrator
ENV NODE_ENV=production

# `prisma migrate deploy` needs the CLI plus the migrations directory; the
# runner image carries neither, which is deliberate — a web pod must not be
# able to mutate the schema of the database it is querying.
#
# node_modules comes from the pruned `migrate-deps`, which derives from
# `builder` — the stage where `prisma generate` ran. `npm run db:seed`
# instantiates a PrismaClient and needs that generated client present.
COPY --from=migrate-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node tsconfig.json ./
# `prisma/seed.ts` imports the gamification rules out of src/, so seeding needs
# the source tree even though nothing here is compiled.
COPY --chown=node:node src ./src

USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npx", "prisma", "migrate", "deploy"]
