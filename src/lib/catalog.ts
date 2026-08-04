import { prisma } from "@/lib/prisma";
import { computeDecisionScores } from "@/lib/scoring";
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
): Promise<{ categoryName: string; listings: (ListingDTO & { score: number; trend: PriceTrend | null })[] }> {
  const result = await getCategoryWithListings(sectorSlug, categorySlug);
  if (!result) return { categoryName: "", listings: [] };

  const trends = await getListingPriceTrends(result.listings.map((l) => l.id));
  const scores = computeDecisionScores(result.listings, result.attributeSchema, trends, priceWeight);
  const sorted = [...result.listings]
    .map((l) => ({ ...l, score: scores[l.id]?.total ?? 0, trend: trends[l.id] ?? null }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { categoryName: result.name, listings: sorted };
}

/**
 * Reads a user's SectorFootprint for the given sector and derives a price
 * weight for computeDecisionScores — a footprint indicating low spend biases
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
 * current listings, sorted by a footprint-biased, trend-aware Decision Score
 * — instead of the same generic "best value this week" shown to everyone.
 *
 * Candidate categories come from two sources, in priority order: categories
 * the user has actually compared/saved (explicit signal), then — to avoid an
 * empty feed for a user who onboarded but hasn't compared anything yet — the
 * first category of each sector in their onboarding footprint (implicit
 * signal). Categories with no listings yet (e.g. a coming-soon sector) are
 * dropped by the final filter.
 */
export async function getPersonalizedSpecials(
  userId: string,
  limit = 4,
): Promise<
  {
    sectorSlug: string;
    categorySlug: string;
    categoryName: string;
    listings: (ListingDTO & { score: number; trend: PriceTrend | null })[];
  }[]
> {
  const [comparisons, saved, footprints] = await Promise.all([
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
    prisma.sectorFootprint.findMany({ where: { userId } }),
  ]);

  const candidates = new Map<string, { sectorSlug: string; categorySlug: string }>();
  for (const c of comparisons) {
    candidates.set(c.category.id, { sectorSlug: c.category.sector.slug, categorySlug: c.category.slug });
  }
  for (const s of saved) {
    candidates.set(s.listing.category.id, {
      sectorSlug: s.listing.category.sector.slug,
      categorySlug: s.listing.category.slug,
    });
  }

  const engagedSectors = new Set([...candidates.values()].map((c) => c.sectorSlug));
  for (const footprint of footprints) {
    if (engagedSectors.has(footprint.sector)) continue;
    const [firstCategory] = await getSectorCategories(footprint.sector);
    if (firstCategory) candidates.set(firstCategory.id, { sectorSlug: footprint.sector, categorySlug: firstCategory.slug });
  }

  if (candidates.size === 0) return [];

  const results = await Promise.all(
    [...candidates.values()].slice(0, 3).map(async ({ sectorSlug, categorySlug }) => {
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

/**
 * "Others also compared" — the Amazon-style social-proof pattern named in
 * the build plan but never implemented. Scans recent Comparison rows that
 * included this listing, tallies which other listings showed up alongside
 * it most often, and returns the top few in rank order. No separate
 * aggregation table — computed from Comparison rows that already exist.
 */
export async function getAlsoCompared(listingId: string, limit = 4): Promise<ListingDTO[]> {
  const comparisons = await prisma.comparison.findMany({
    where: { listingIds: { has: listingId } },
    select: { listingIds: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const counts = new Map<string, number>();
  for (const comparison of comparisons) {
    for (const otherId of comparison.listingIds) {
      if (otherId === listingId) continue;
      counts.set(otherId, (counts.get(otherId) ?? 0) + 1);
    }
  }

  const rankedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (rankedIds.length === 0) return [];

  const listings = await getListingsByIds(rankedIds);
  const byId = new Map(listings.map((l) => [l.id, l]));
  return rankedIds.map((id) => byId.get(id)).filter((l): l is ListingDTO => !!l);
}

export type MarketOverview = {
  bySector: {
    sectorSlug: string;
    sectorName: string;
    listingCount: number;
    avgPrice: number;
    trendingDown: number;
    trendingUp: number;
    unverifiedCount: number;
  }[];
  anomalies: { listing: ListingDTO; sectorName: string; categoryName: string; trend: PriceTrend }[];
  unverifiedListings: { listing: ListingDTO; sectorName: string; categoryName: string }[];
};

/**
 * Aggregates every live listing into a market-wide view — per-sector
 * pricing/trend/trust rollups, the biggest recent price swings, and
 * unverified-provider listings. Shared root for the Corporate ("Market
 * Intelligence") and Regulator ("Compliance & Market Monitoring")
 * dashboards, computed entirely from existing listing/price-history data —
 * no separate aggregation tables.
 */
export async function getMarketOverview(): Promise<MarketOverview> {
  const rows = await prisma.listing.findMany({
    where: { category: { sector: { status: "live" } } },
    include: { provider: true, category: { include: { sector: true } } },
  });
  const trends = await getListingPriceTrends(rows.map((r) => r.id));

  const bySector = new Map<string, MarketOverview["bySector"][number]>();
  const anomalies: MarketOverview["anomalies"] = [];
  const unverifiedListings: MarketOverview["unverifiedListings"] = [];

  for (const row of rows) {
    const sectorSlug = row.category.sector.slug;
    const entry = bySector.get(sectorSlug) ?? {
      sectorSlug,
      sectorName: row.category.sector.name,
      listingCount: 0,
      avgPrice: 0,
      trendingDown: 0,
      trendingUp: 0,
      unverifiedCount: 0,
    };
    const price = Number(row.price);
    entry.avgPrice = (entry.avgPrice * entry.listingCount + price) / (entry.listingCount + 1);
    entry.listingCount += 1;
    if (!row.provider.verified) entry.unverifiedCount += 1;

    const trend = trends[row.id];
    if (trend) {
      if (trend.direction === "down") entry.trendingDown += 1;
      if (trend.direction === "up") entry.trendingUp += 1;
    }
    bySector.set(sectorSlug, entry);

    const listing = toListingDTO(row);
    if (trend && trend.direction !== "flat") {
      anomalies.push({ listing, sectorName: row.category.sector.name, categoryName: row.category.name, trend });
    }
    if (!row.provider.verified) {
      unverifiedListings.push({ listing, sectorName: row.category.sector.name, categoryName: row.category.name });
    }
  }

  anomalies.sort((a, b) => Math.abs(b.trend.changePercent) - Math.abs(a.trend.changePercent));

  return {
    bySector: [...bySector.values()].map((s) => ({ ...s, avgPrice: Math.round(s.avgPrice * 100) / 100 })),
    anomalies: anomalies.slice(0, 10),
    unverifiedListings,
  };
}
