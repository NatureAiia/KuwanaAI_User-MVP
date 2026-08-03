import { prisma } from "@/lib/prisma";
import { computeValueScores } from "@/lib/scoring";
import { computePriceTrend, type PriceTrend } from "@/lib/priceTrend";
import type { CategoryDTO, CategoryWithListingsDTO, ListingDTO } from "@/types/catalog";

function toListingDTO(listing: {
  id: string;
  name: string;
  price: unknown;
  currency: string;
  attributes: unknown;
  freshnessStatus: string;
  lastVerifiedAt: Date;
  sourceUrl: string | null;
  provider: { id: string; name: string; logoUrl: string | null; verified: boolean };
}): ListingDTO {
  return {
    id: listing.id,
    name: listing.name,
    price: Number(listing.price),
    currency: listing.currency,
    attributes: listing.attributes as Record<string, unknown>,
    freshnessStatus: listing.freshnessStatus as ListingDTO["freshnessStatus"],
    lastVerifiedAt: listing.lastVerifiedAt.toISOString(),
    sourceUrl: listing.sourceUrl,
    provider: listing.provider,
  };
}

export async function getSectorCategories(sectorSlug: string): Promise<CategoryDTO[]> {
  const sector = await prisma.sectorConfig.findUnique({
    where: { slug: sectorSlug },
    include: { categories: { include: { attributeSchema: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!sector) return [];
  return sector.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    attributeSchema: c.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    })),
  }));
}

export async function getCategoryWithListings(
  sectorSlug: string,
  categorySlug: string,
): Promise<CategoryWithListingsDTO | null> {
  const sector = await prisma.sectorConfig.findUnique({ where: { slug: sectorSlug } });
  if (!sector) return null;

  const category = await prisma.category.findUnique({
    where: { sectorId_slug: { sectorId: sector.id, slug: categorySlug } },
    include: {
      attributeSchema: { orderBy: { sortOrder: "asc" } },
      listings: { include: { provider: true }, orderBy: { price: "asc" } },
    },
  });
  if (!category) return null;

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    attributeSchema: category.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    })),
    listings: category.listings.map(toListingDTO),
  };
}

export async function getTopListings(
  sectorSlug: string,
  categorySlug: string,
  limit = 4,
  priceWeight = 0.5,
): Promise<{ categoryName: string; listings: (ListingDTO & { score: number })[] }> {
  const result = await getCategoryWithListings(sectorSlug, categorySlug);
  if (!result) return { categoryName: "", listings: [] };

  const scores = computeValueScores(result.listings, result.attributeSchema, priceWeight);
  const sorted = [...result.listings]
    .map((l) => ({ ...l, score: scores[l.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { categoryName: result.name, listings: sorted };
}

/**
 * Reads a user's SectorFootprint for the given sector and derives a price
 * weight for computeValueScores — a footprint indicating low spend biases
 * the score toward price-sensitivity rather than the default 50/50 split.
 * Falls back to 0.5 when there's no footprint or no recognizable spend field.
 *
 * Spend fields are free-text ranges from onboarding (e.g. "Under $10",
 * "$10–$25", "$25–$50", "$50+" — see SPEND_RANGES in onboarding-options.ts),
 * not pre-bucketed labels, so this reads the highest number in the string
 * rather than matching against "low"/"medium"/"high" keywords.
 */
export async function getFootprintPriceWeight(userId: string, sectorSlug: string): Promise<number> {
  const footprint = await prisma.sectorFootprint.findUnique({
    where: { userId_sector: { userId, sector: sectorSlug as never } },
  });
  if (!footprint) return 0.5;

  const data = footprint.data as Record<string, unknown>;
  const spendField = Object.entries(data).find(([key]) => key.toLowerCase().includes("spend"));
  const spendValue = typeof spendField?.[1] === "string" ? spendField[1] : "";
  const numbers = spendValue.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return 0.5;

  const maxSpend = Math.max(...numbers);
  if (maxSpend <= 10) return 0.7;
  if (maxSpend <= 25) return 0.6;
  if (maxSpend <= 50) return 0.5;
  return 0.3;
}

/**
 * "Specials for you" (KUWANA_DECISION_INTELLIGENCE_PLAN.md Section 4): joins
 * the user's footprint and comparison/saved-listing engagement against
 * current listings, filtered to categories they actually engage with, sorted
 * by a footprint-biased value score — instead of the same generic "best
 * value this week" shown to everyone.
 */
export async function getPersonalizedSpecials(
  userId: string,
  limit = 4,
): Promise<{ sectorSlug: string; categorySlug: string; categoryName: string; listings: (ListingDTO & { score: number })[] }[]> {
  const [comparisons, saved] = await Promise.all([
    prisma.comparison.findMany({
      where: { userId },
      include: { category: { include: { sector: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.savedListing.findMany({
      where: { userId },
      include: { listing: { include: { category: { include: { sector: true } } } } },
      take: 10,
    }),
  ]);

  const engaged = new Map<string, { sectorSlug: string; categorySlug: string }>();
  for (const c of comparisons) {
    engaged.set(c.category.id, { sectorSlug: c.category.sector.slug, categorySlug: c.category.slug });
  }
  for (const s of saved) {
    engaged.set(s.listing.category.id, {
      sectorSlug: s.listing.category.sector.slug,
      categorySlug: s.listing.category.slug,
    });
  }

  if (engaged.size === 0) return [];

  const results = await Promise.all(
    [...engaged.values()].slice(0, 3).map(async ({ sectorSlug, categorySlug }) => {
      const priceWeight = await getFootprintPriceWeight(userId, sectorSlug);
      const { categoryName, listings } = await getTopListings(sectorSlug, categorySlug, limit, priceWeight);
      return { sectorSlug, categorySlug, categoryName, listings };
    }),
  );

  return results.filter((r) => r.listings.length > 0);
}

/**
 * Fetches ListingPriceHistory rows for the given listings and reduces each
 * to a PriceTrend (or null if there's no history yet). Keyed by listing id
 * so callers can look up a listing's trend alongside its other data.
 */
export async function getListingPriceTrends(listingIds: string[]): Promise<Record<string, PriceTrend | null>> {
  if (listingIds.length === 0) return {};

  const rows = await prisma.listingPriceHistory.findMany({
    where: { listingId: { in: listingIds } },
    orderBy: { recordedAt: "asc" },
  });

  const grouped = new Map<string, { price: number; recordedAt: Date }[]>();
  for (const row of rows) {
    const arr = grouped.get(row.listingId) ?? [];
    arr.push({ price: Number(row.price), recordedAt: row.recordedAt });
    grouped.set(row.listingId, arr);
  }

  const result: Record<string, PriceTrend | null> = {};
  for (const id of listingIds) {
    result[id] = computePriceTrend(grouped.get(id) ?? []);
  }
  return result;
}

export async function getListingsByIds(ids: string[]): Promise<ListingDTO[]> {
  const listings = await prisma.listing.findMany({
    where: { id: { in: ids } },
    include: { provider: true },
  });
  return listings.map(toListingDTO);
}
