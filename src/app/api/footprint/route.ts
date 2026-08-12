import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { sectorEnum, boundedJsonRecord } from "@/lib/zodShared";

const bodySchema = z.object({
  sector: sectorEnum,
  // A footprint is a handful of onboarding answers. Unbounded, it was a
  // free write-amplification primitive into a Json column.
  data: boundedJsonRecord(40, 8_000),
});

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const limited = await enforceRateLimit(`footprint:${user.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const footprint = await prisma.sectorFootprint.upsert({
    where: { userId_sector: { userId: user.id, sector: parsed.data.sector } },
    update: { data: parsed.data.data as Prisma.InputJsonValue },
    create: { userId: user.id, sector: parsed.data.sector, data: parsed.data.data as Prisma.InputJsonValue },
  });

  return privateJson({ footprint });
}

export async function GET(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const rawSector = searchParams.get("sector");

  // `sector as never` previously handed an arbitrary query string straight
  // to a Postgres enum column: any junk value threw out of Prisma as an
  // unhandled 500 rather than a 400, which is both a bad contract and a
  // cheap way to fill the error log.
  const sector = rawSector ? sectorEnum.safeParse(rawSector) : null;
  if (sector && !sector.success) {
    return NextResponse.json({ error: "Unknown sector" }, { status: 400 });
  }

  const footprints = await prisma.sectorFootprint.findMany({
    where: { userId: user.id, ...(sector?.success ? { sector: sector.data } : {}) },
  });

  return privateJson({ footprints });
}
