import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import { computeTraditionalComparison } from "@/lib/traditionalCompare";
import { computeBciForListings } from "@/lib/bciServer";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

/**
 * Flow 4 (Quick Search -> Ranking Engine) from the uploaded docs — the one
 * comparison flow with no LLM in the loop at all: a filter box straight into
 * the deterministic engines (traditionalCompare.ts + bci.ts), never a
 * generation. Unauthenticated, same reasoning as /api/traditional-comparison
 * (no user context needed, anonymous browsing is already supported).
 */
const bodySchema = z.object({
  sectorSlug: z.string(),
  categorySlug: z.string(),
  // Exact-match filters against the category's own attribute keys (e.g.
  // { province: "Harare", customer_type: "Youth" }) — validated against the
  // real schema server-side, not trusted as arbitrary SQL.
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  maxPrice: z.number().positive().optional(),
});

// Never a full dump, per the docs' own "max 50 rows" rule for anything an
// LLM-adjacent ranking surface returns — this route stays well under that
// even though it never calls an LLM itself.
const MAX_RESULTS = 50;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`quick-search:${clientKey(req)}`, RATE_LIMITS.publicRead);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid search" }, { status: 400 });
  const { sectorSlug, categorySlug, filters, maxPrice } = parsed.data;

  const category = await prisma.category.findFirst({
    where: { slug: categorySlug, sector: { slug: sectorSlug } },
    include: { attributeSchema: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  // Only accept filter keys that are real, comparable fields on this
  // category — an unknown key is dropped rather than erroring, so a stale
  // client-side filter never breaks the search.
  const validKeys = new Set(category.attributeSchema.filter((a) => a.isComparable).map((a) => a.key));
  const appliedFilters = Object.fromEntries(Object.entries(filters).filter(([k]) => validKeys.has(k)));

  const where = {
    categoryId: category.id,
    status: "published" as const,
    ...(maxPrice ? { price: { lte: maxPrice } } : {}),
  };

  const rows = await prisma.listing.findMany({
    where,
    include: { provider: true },
    orderBy: { price: "asc" },
    take: 200, // pre-filter pool, narrowed by attribute filters below before the MAX_RESULTS cap
  });

  const filtered = rows.filter((l) => {
    const attrs = l.attributes as Record<string, unknown>;
    return Object.entries(appliedFilters).every(([k, v]) => {
      const actual = attrs[k];
      if (typeof v === "string" && typeof actual === "string") return actual.toLowerCase() === v.toLowerCase();
      return actual === v;
    });
  });

  const bounded = filtered.slice(0, MAX_RESULTS);
  if (bounded.length === 0) {
    return NextResponse.json({ engine: "quick_search", categoryName: category.name, results: [], text: null });
  }

  const listingIds = bounded.map((l) => l.id);
  const trends = await getListingPriceTrends(listingIds);
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
  const listingDTOs: ListingDTO[] = bounded.map((l) => ({
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

  const bciScores = await computeBciForListings(listingDTOs, attributeSchema, { trends });

  let engineResult: ReturnType<typeof computeTraditionalComparison> | null = null;
  if (bounded.length >= 2) {
    engineResult = computeTraditionalComparison({
      categoryName: category.name,
      categorySlug: category.slug,
      attributeSchema,
      listings: bounded.map((l) => ({
        id: l.id,
        name: l.name,
        provider: l.provider.name,
        providerVerified: l.provider.verified,
        price: Number(l.price),
        currency: l.currency,
        attributes: l.attributes as Record<string, unknown>,
        freshnessStatus: l.freshnessStatus,
        trendPercent: trends[l.id]?.changePercent ?? null,
      })),
    });
  }

  const results = bounded
    .map((l) => ({
      id: l.id,
      name: l.name,
      provider: l.provider.name,
      price: Number(l.price),
      currency: l.currency,
      bciScore: bciScores[l.id]?.total ?? null,
    }))
    .sort((a, b) => (b.bciScore ?? 0) - (a.bciScore ?? 0));

  return NextResponse.json({
    engine: "quick_search",
    categoryName: category.name,
    truncated: filtered.length > MAX_RESULTS,
    results,
    winner: engineResult?.winner ?? null,
    text: engineResult?.text ?? null,
  });
}
