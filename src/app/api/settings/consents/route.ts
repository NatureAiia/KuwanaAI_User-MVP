import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  research_use: z.boolean().optional(),
  leaderboard_participation: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  for (const [consentType, granted] of Object.entries(parsed.data)) {
    if (granted === undefined) continue;
    await prisma.consent.upsert({
      where: { userId_consentType: { userId: user.id, consentType } },
      update: { granted, grantedAt: new Date() },
      create: { userId: user.id, consentType, granted },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const consents = await prisma.consent.findMany({ where: { userId: user.id } });
  return NextResponse.json({
    consents: Object.fromEntries(consents.map((c) => [c.consentType, c.granted])),
  });
}
