import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";

const bodySchema = z.object({
  research_use: z.boolean().optional(),
  leaderboard_participation: z.boolean().optional(),
  health_data_sharing: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // A consent save touches at most three rows; run them concurrently instead
  // of a serialized round-trip each. Same upsert pattern as notifications.
  await Promise.all(
    Object.entries(parsed.data)
      .filter(([, granted]) => granted !== undefined)
      .map(([consentType, granted]) =>
        prisma.consent.upsert({
          where: { userId_consentType: { userId: user.id, consentType } },
          update: { granted, grantedAt: new Date() },
          create: { userId: user.id, consentType, granted },
        }),
      ),
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const consents = await prisma.consent.findMany({ where: { userId: user.id } });
  return NextResponse.json({
    consents: Object.fromEntries(consents.map((c) => [c.consentType, c.granted])),
  });
}
