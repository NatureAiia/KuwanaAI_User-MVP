import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 requires an explicit driver adapter instead of a schema-embedded
 * connection string. Shared by src/lib/prisma.ts (the app singleton) and
 * prisma/seed.ts (its own PrismaClient instance) so pool construction isn't
 * duplicated.
 */

/**
 * Matches deploy/helm/kuwana/values.yaml `database.connectionLimit`, which the
 * chart passes in as DATABASE_POOL_MAX.
 *
 * This has to be read here, explicitly, because `pg.Pool` does not understand
 * Prisma's `connection_limit` / `pool_timeout` connection-string parameters —
 * it silently ignores them and applies its own default of 10. Before this was
 * wired up, the chart composed a URL carrying `?connection_limit=5`, the
 * `kuwana.checkConnectionBudget` helper refused to render any release whose
 * `replicas x connectionLimit` exceeded `max_connections`, and every pod then
 * opened twice the number it had been budgeted for. The guard read as proof
 * the budget held while the application quietly broke it.
 *
 * So: change this default and the chart value together, or neither.
 */
const DEFAULT_POOL_MAX = 5;

function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_POOL_MAX;
}

export function createPrismaAdapter() {
  return new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
      max: poolMax(),
      // Fail a checkout rather than queue forever when every connection is
      // busy: a request that cannot get a connection inside 20s has already
      // lost, and holding it open only deepens the queue behind it. Mirrors
      // the `pool_timeout=20` the chart puts on the URL, which pg ignores.
      connectionTimeoutMillis: 20_000,
      // Return idle connections to the pooler instead of pinning them for the
      // life of the pod, which matters most against Supabase's shared pooler
      // where our idle connection is someone else's unavailable one.
      idleTimeoutMillis: 30_000,
    }),
  );
}
