import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, clientKey } from "@/lib/rateLimit";
import { sectorEnum } from "@/lib/zodShared";

const bodySchema = z.object({
  // Normalized to lowercase so the [email, sector] unique constraint can
  // actually do its job — "A@x.com" and "a@x.com" were previously two rows.
  email: z.string().trim().toLowerCase().email().max(254),
  sector: sectorEnum.default("healthcare"),
});

// Unauthenticated and public by design (the whole point is capturing interest
// pre-signup) — generous enough for a real visitor signing up for a couple of
// sectors, tight enough to blunt a scripted flood of fake emails.
const RATE_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`waitlist:${clientKey(req)}`, RATE_LIMIT);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.waitlistSignup.upsert({
    where: { email_sector: { email: parsed.data.email, sector: parsed.data.sector } },
    update: {},
    create: parsed.data,
  });

  // Deliberately identical whether the row was created or already existed —
  // a distinguishable response would turn this into an oracle for "is this
  // address on the waitlist".
  return privateJson({ ok: true });
}
