import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  sector: z.enum([
    "telecom",
    "banking",
    "insurance",
    "education",
    "healthcare",
    "transport",
    "utilities",
    "pharmacy",
  ]),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const footprint = await prisma.sectorFootprint.upsert({
    where: { userId_sector: { userId: user.id, sector: parsed.data.sector } },
    update: { data: parsed.data.data as Prisma.InputJsonValue },
    create: { userId: user.id, sector: parsed.data.sector, data: parsed.data.data as Prisma.InputJsonValue },
  });

  return NextResponse.json({ footprint });
}

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");

  const footprints = await prisma.sectorFootprint.findMany({
    where: { userId: user.id, ...(sector ? { sector: sector as never } : {}) },
  });

  return NextResponse.json({ footprints });
}
