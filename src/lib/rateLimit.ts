import { prisma } from "@/lib/prisma";

/** Vercel (see vercel.json) sets this on every request; falls back for local dev. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * Fixed-window rate limit backed by Postgres (RateLimitHit), not an
 * in-memory counter — this app deploys to Vercel serverless, where an
 * in-memory Map wouldn't reliably survive across invocations/instances.
 * Self-cleaning: deletes this key's own expired hits on every call, scoped
 * to that one key (not a full-table scan), so no separate cleanup cron is
 * needed. Returns true if the call is allowed (and records it), false if
 * the caller is over the limit for this window.
 */
export async function checkRateLimit(key: string, opts: { windowMs: number; max: number }): Promise<boolean> {
  const { windowMs, max } = opts;
  const windowStart = new Date(Date.now() - windowMs);

  await prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } });

  const count = await prisma.rateLimitHit.count({ where: { key } });
  if (count >= max) return false;

  await prisma.rateLimitHit.create({ data: { key } });
  return true;
}
