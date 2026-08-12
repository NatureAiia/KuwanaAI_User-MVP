import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

// Prisma 7 moved the CLI's connection config out of schema.prisma (see
// prisma/schema.prisma's datasource block) and into this file. DIRECT_URL,
// not DATABASE_URL, is used here because migrations should run against a
// non-pooled connection — see src/lib/prismaAdapter.ts for the app runtime's
// connection, which uses DATABASE_URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
