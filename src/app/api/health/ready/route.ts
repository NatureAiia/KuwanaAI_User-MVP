import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Readiness probe: may this pod receive traffic?
 *
 * Fails when a hard dependency is missing, which takes the pod out of the
 * Service endpoints without restarting it — the correct response to "Postgres
 * is unreachable" or "the config is incomplete". It is also what gates a
 * rolling deploy: a new ReplicaSet that can't reach its database never
 * displaces the old one.
 *
 * The database check is a bare `SELECT 1` with a short timeout. Anything
 * heavier turns every probe interval into real query load — at 10s intervals
 * across N replicas that adds up faster than it looks.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DB_TIMEOUT_MS = 3_000;

/** Env the server cannot function without; absence is a config fault, not a transient one. */
const REQUIRED_ENV = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
  checks.config = missingEnv.length
    ? { ok: false, detail: `missing: ${missingEnv.join(", ")}` }
    : { ok: true };

  const startedAt = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS);
    checks.database = { ok: true, detail: `${Date.now() - startedAt}ms` };
  } catch (error) {
    // The message can carry the connection string's host and, on some driver
    // errors, its credentials — log it server-side, never return it.
    console.error("[readiness] database check failed", error);
    checks.database = { ok: false, detail: "unreachable" };
  }

  const ready = Object.values(checks).every((check) => check.ok);
  const response = NextResponse.json(
    { status: ready ? "ready" : "not_ready", checks },
    { status: ready ? 200 : 503 },
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
