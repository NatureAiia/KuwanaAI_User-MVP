import { NextResponse } from "next/server";

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
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return null;
}
