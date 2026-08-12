import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 requires an explicit driver adapter instead of a schema-embedded
 * connection string. Shared by src/lib/prisma.ts (the app singleton) and
 * prisma/seed.ts (its own PrismaClient instance) so pool construction isn't
 * duplicated.
 */
export function createPrismaAdapter() {
  return new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }));
}
