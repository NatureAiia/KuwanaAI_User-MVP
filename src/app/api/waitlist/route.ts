import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, clientKey } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sectorEnum } from "@/lib/zodShared";

const bodySchema = z.object({
  // Normalized to lowercase so the [email, sector] unique constraint can
  // actually do its job — "A@x.com" and "a@x.com" were previously two rows.
  email: z.string().trim().toLowerCase().email().max(254),
  sector: sectorEnum.default("healthcare"),
  // Optional in the schema, but enforced below whenever a Turnstile secret is
  // configured — so a deployment without one keeps working unchanged.
  turnstileToken: z.string().max(4096).optional(),
});

// Unauthenticated and public by design (the whole point is capturing interest
// pre-signup) — generous enough for a real visitor signing up for a couple of
// sectors, tight enough to blunt a scripted flood of fake emails.
const RATE_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

export async function POST(req: Request) {
  const ip = clientKey(req);
  const limited = await enforceRateLimit(`waitlist:${ip}`, RATE_LIMIT);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // A rate limit bounds how fast one client can write; it does nothing about a
  // botnet spreading the same flood thinly across many addresses. This is the
  // control for that. No-ops entirely when TURNSTILE_SECRET_KEY is unset.
  const captcha = await verifyTurnstileToken(parsed.data.turnstileToken, ip);
  if (!captcha.ok) {
    return NextResponse.json({ error: "Couldn't verify you're human — please try again." }, { status: 403 });
  }

  const { email, sector } = parsed.data;
  await prisma.waitlistSignup.upsert({
    where: { email_sector: { email, sector } },
    update: {},
    // Destructured rather than spreading `parsed.data`, which now carries a
    // turnstileToken that is not a column and must not reach the DB.
    create: { email, sector },
  });

  // Deliberately identical whether the row was created or already existed —
  // a distinguishable response would turn this into an oracle for "is this
  // address on the waitlist".
  return privateJson({ ok: true });
}
