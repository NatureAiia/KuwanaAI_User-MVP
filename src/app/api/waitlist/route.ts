import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SECTORS } from "@/lib/sectors";

const SECTOR_SLUGS = Object.keys(SECTORS) as [string, ...string[]];
const bodySchema = z.object({
  email: z.string().email(),
  sector: z.enum(SECTOR_SLUGS).default("healthcare"),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.waitlistSignup.upsert({
    where: { email_sector: { email: parsed.data.email, sector: parsed.data.sector } },
    update: {},
    create: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
