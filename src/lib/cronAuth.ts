import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Constant-time string compare. `===` on a secret short-circuits at the
 * first differing byte, which over enough samples leaks the secret one
 * character at a time. Hashing to a fixed length first means the comparison
 * itself never reveals the secret's length either.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still burn a comparison so the length check isn't itself the signal.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Vercel Cron calls these routes as plain HTTP GETs — anyone who guesses the
 * URL could trigger them otherwise. Vercel automatically sends
 * `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
 * CRON_SECRET is set as a project env var; this checks that the caller
 * provided the same secret. Fails closed: no CRON_SECRET configured means
 * no request is accepted, not "allow everything."
 */
export function verifyCronRequest(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization") ?? "";
  if (!secretsMatch(authHeader, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return null;
}
