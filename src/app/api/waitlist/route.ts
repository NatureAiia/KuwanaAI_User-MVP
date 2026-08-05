import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SECTORS } from "@/lib/sectors";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const SECTOR_SLUGS = Object.keys(SECTORS) as [string, ...string[]];
const bodySchema = z.object({
  email: z.string().email(),
  sector: z.enum(SECTOR_SLUGS).default("healthcare"),
});

// Unauthenticated and public by design (the whole point is capturing interest
// pre-signup) — generous enough for a real visitor signing up for a couple of
// sectors, tight enough to blunt a scripted flood of fake emails.
const RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`waitlist:${getClientIp(req)}`, RATE_LIMIT);
  if (!allowed) return NextResponse.json({ error: "Too many requests — try again later." }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.waitlistSignup.upsert({
    where: { email_sector: { email: parsed.data.email, sector: parsed.data.sector } },
    update: {},
    create: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
