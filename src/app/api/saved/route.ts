import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { recordEvent } from "@/lib/gamification/process-event";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({ listingId: z.string() });

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const listing = await prisma.listing.findFirst({
    where: { id: parsed.data.listingId, status: "published" },
    include: { category: { include: { sector: true } } },
  });
  if (!listing) return privateJson({ error: "Listing not found" }, { status: 404 });

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

  return privateJson({ gamification: result });
}

export async function DELETE(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.savedListing.deleteMany({
    where: { userId: user.id, listingId: parsed.data.listingId },
  });

  return privateJson({ ok: true });
}

export async function GET() {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  // Capped: nothing limits how many listings a user may save, so this
  // response grew without bound and was fetching three joined tables per
  // row. The saved list is a browsing surface, not an export.
  const saved = await prisma.savedListing.findMany({
    where: { userId: user.id },
    include: { listing: { include: { provider: true, category: { include: { sector: true } } } } },
    orderBy: { savedAt: "desc" },
    take: 200,
  });

  return privateJson({
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
