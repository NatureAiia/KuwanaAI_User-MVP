import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { recordEvent } from "@/lib/gamification/process-event";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({
  categoryId: z.string(),
  // Capped: a Comparison row's listingIds is an unbounded Postgres array, and
  // it is read back by getAlsoCompared() over the last 200 comparisons. An
  // uncapped array is both a storage amplifier and a way to swamp that query.
  listingIds: z.array(z.string()).min(2).max(10),
});

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const limited = await enforceRateLimit(`comparisons:${user.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { categoryId, listingIds } = parsed.data;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { sector: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  // listingIds went straight into the row unverified, and Comparison rows are
  // the *only* input to getAlsoCompared() — the "others also compared" rail
  // rendered on every listing page. Any account could therefore post a
  // comparison pairing a competitor's listing with its own and have the
  // platform recommend it, or inject ids for unpublished/nonexistent
  // listings. Requiring every id to be a published listing in the category
  // being compared closes both.
  const uniqueIds = [...new Set(listingIds)];
  const validListings = await prisma.listing.findMany({
    where: { id: { in: uniqueIds }, categoryId, status: "published" },
    select: { id: true },
  });
  if (validListings.length !== uniqueIds.length || validListings.length < 2) {
    return NextResponse.json(
      { error: "Every listing compared must be a published listing in this category" },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const comparison = await tx.comparison.create({
        data: { userId: user.id, categoryId, listingIds: uniqueIds },
      });
      const gamification = await recordEvent(tx, {
        userId: user.id,
        eventType: "comparison_completed",
        sector: category.sector.slug as Sector,
        metadata: { categoryId, listingIds: uniqueIds },
      });
      return { comparison, gamification };
    },
    { timeout: 15_000 },
  );

  return privateJson(result);
}

export async function GET() {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const comparisons = await prisma.comparison.findMany({
    where: { userId: user.id },
    include: { category: { include: { sector: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return privateJson({ comparisons });
}
