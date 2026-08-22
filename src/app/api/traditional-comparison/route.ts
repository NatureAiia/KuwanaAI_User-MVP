import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import { computeTraditionalComparison } from "@/lib/traditionalCompare";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

const bodySchema = z.object({
  listingIds: z.array(z.string()).min(2).max(10),
});

/**
 * "Traditional comparison" — a deterministic, rules-based engine
 * (src/lib/traditionalCompare.ts), deliberately not an AI/LLM. The route
 * resolves the requested listings server-side and runs the engine in-process.
 * No auth required: unlike the AI recommendation it needs no user context,
 * and anonymous comparison is already supported.
 */
export async function POST(req: Request) {
  // Unauthenticated, and each call is a multi-row query plus a full
  // attribute-matrix computation. No model is billed, so this is a load
  // control rather than a spend control — hence publicRead, keyed on the
  // best-effort client identity that is all an anonymous route has.
  const limited = await enforceRateLimit(`traditional-comparison:${clientKey(req)}`, RATE_LIMITS.publicRead);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing selection" }, { status: 400 });
  }
  const { listingIds } = parsed.data;

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, status: "published" },
    include: { provider: true, category: { include: { attributeSchema: true } } },
  });
  if (listings.length < 2) {
    return NextResponse.json({ error: "Need at least 2 listings" }, { status: 400 });
  }

  const category = listings[0].category;
  const listingDTOs: ListingDTO[] = listings.map((l) => ({
    id: l.id,
    name: l.name,
    price: Number(l.price),
    currency: l.currency,
    attributes: l.attributes as Record<string, unknown>,
    freshnessStatus: l.freshnessStatus,
    lastVerifiedAt: l.lastVerifiedAt.toISOString(),
    sourceUrl: l.sourceUrl,
    images: l.images,
    description: l.description ?? null,
    rating: l.rating === null || l.rating === undefined ? null : Number(l.rating),
    reviewCount: l.reviewCount ?? 0,
    provider: l.provider,
  }));
  const attributeSchema: AttributeSchemaFieldDTO[] = category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as AttributeSchemaFieldDTO["dataType"],
    unit: a.unit,
    consumerLabel: a.consumerLabel,
    qualityAxis: a.qualityAxis,
    synonyms: a.synonyms,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));
  const trends = await getListingPriceTrends(listingDTOs.map((l) => l.id));

  try {
    const engineResult = computeTraditionalComparison({
      categoryName: category.name,
      categorySlug: category.slug,
      attributeSchema,
      listings: listingDTOs.map((l) => ({
        id: l.id,
        name: l.name,
        provider: l.provider.name,
        providerVerified: l.provider.verified,
        price: l.price,
        currency: l.currency,
        attributes: l.attributes,
        freshnessStatus: l.freshnessStatus,
        trendPercent: trends[l.id]?.changePercent ?? null,
      })),
    });
    return NextResponse.json({
      engine: "traditional",
      categoryName: category.name,
      text: engineResult.text,
      winner: engineResult.winner,
      runnerUps: engineResult.runnerUps,
      note: engineResult.note,
    });
  } catch (err) {
    console.error("[traditional-comparison] engine failed:", err);
    return NextResponse.json({ error: "The comparison engine isn't available right now." }, { status: 503 });
  }
}
