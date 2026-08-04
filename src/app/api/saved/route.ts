import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { recordEvent } from "@/lib/gamification/process-event";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({ listingId: z.string() });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { category: { include: { sector: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.savedListing.upsert({
        where: { userId_listingId: { userId: user.id, listingId: listing.id } },
        update: {},
        create: { userId: user.id, listingId: listing.id },
      });
      const gamification = await recordEvent(tx, {
        userId: user.id,
        eventType: "item_saved",
        sector: listing.category.sector.slug as Sector,
        metadata: { listingId: listing.id },
      });
      return gamification;
    },
    { timeout: 15_000 },
  );

  return NextResponse.json({ gamification: result });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.savedListing.deleteMany({
    where: { userId: user.id, listingId: parsed.data.listingId },
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const saved = await prisma.savedListing.findMany({
    where: { userId: user.id },
    include: { listing: { include: { provider: true, category: { include: { sector: true } } } } },
    orderBy: { savedAt: "desc" },
  });

  return NextResponse.json({
    saved: saved.map((s) => ({
      savedAt: s.savedAt,
      listing: {
        id: s.listing.id,
        name: s.listing.name,
        price: Number(s.listing.price),
        currency: s.listing.currency,
        provider: s.listing.provider.name,
        sector: s.listing.category.sector.slug,
        category: s.listing.category.name,
      },
    })),
  });
}
