import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDecisionScores } from "@/lib/scoring";
import { computePriceTrend, type PriceTrend } from "@/lib/priceTrend";
import { CATALOG_TAG, PRICE_HISTORY_TAG } from "@/lib/cacheTags";
import type { CategoryDTO, CategoryWithListingsDTO, ListingDTO } from "@/types/catalog";

/**
 * How long a cached catalog read may serve without a write invalidating it.
 * Writes call revalidateCatalog() and drop the entry immediately, so this is
 * only the backstop for changes made outside the app (a direct SQL edit, a
 * seed re-run, the freshness cron marking listings stale).
 */
const CATALOG_TTL_SECONDS = 300;

/**
 * How far back a price trend looks. 90 days is long enough for
 * computePriceForecast to have the 3+ points it needs to fit a line, and
 * short enough that a listing with years of history doesn't drag its whole
 * table into memory on every explore page render.
 */
const TREND_WINDOW_DAYS = 90;

function trendWindowStart() {
  return new Date(Date.now() - TREND_WINDOW_DAYS * 86_400_000);
}

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

/**
 * Every page under /explore calls this before rendering anything, and the
 * answer changes only when an admin edits the catalog — the clearest
 * caching win in the app.
 */
export const getSectorCategories = unstable_cache(
  async (sectorSlug: string): Promise<CategoryDTO[]> => {
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
  },
  ["sector-categories"],
  { tags: [CATALOG_TAG], revalidate: CATALOG_TTL_SECONDS },
);

export const getCategoryWithListings = unstable_cache(
  async (sectorSlug: string, categorySlug: string): Promise<CategoryWithListingsDTO | null> => {
    const sector = await prisma.sectorConfig.findUnique({ where: { slug: sectorSlug } });
    if (!sector) return null;

    const category = await prisma.category.findUnique({
      where: { sectorId_slug: { sectorId: sector.id, slug: categorySlug } },
      include: {
        attributeSchema: { orderBy: { sortOrder: "asc" } },
        listings: {
          where: { status: "published" },
          include: { provider: true },
          orderBy: { price: "asc" },
        },
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
  },
  ["category-with-listings"],
  { tags: [CATALOG_TAG], revalidate: CATALOG_TTL_SECONDS },
);

/**
 * Not itself wrapped in unstable_cache: `priceWeight` is derived from the
 * calling user's footprint, so caching on it would either key the cache by
 * user (defeating the point) or serve one user's weighting to another. Both
 * of the DB reads it makes are cached individually, so the uncached part is
 * pure in-memory scoring.
 */
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

  // Fetched in parallel rather than sequentially in the loop: a user with
  // footprints in five sectors was paying five serial round-trips before
  // their dashboard could render its first tile.
  const engagedSectors = new Set([...candidates.values()].map((c) => c.sectorSlug));
  const unengaged = footprints.filter((f) => !engagedSectors.has(f.sector));
  const firstCategories = await Promise.all(
    unengaged.map(async (footprint) => ({
      sectorSlug: footprint.sector,
      category: (await getSectorCategories(footprint.sector))[0],
    })),
  );
  for (const { sectorSlug, category } of firstCategories) {
    if (category) candidates.set(category.id, { sectorSlug, categorySlug: category.slug });
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
export const getListingPriceTrends = unstable_cache(
  async (listingIds: string[]): Promise<Record<string, PriceTrend | null>> => {
    if (listingIds.length === 0) return {};

    const rows = await prisma.listingPriceHistory.findMany({
      // Bounded to the trend window instead of every row ever recorded: the
      // table grows one row per price change per listing forever, and
      // computePriceTrend only ever looks at recent movement.
      where: { listingId: { in: listingIds }, recordedAt: { gte: trendWindowStart() } },
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
  },
  ["listing-price-trends"],
  { tags: [PRICE_HISTORY_TAG], revalidate: CATALOG_TTL_SECONDS },
);

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof readListingDetail>>>;

async function readListingDetail(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      provider: true,
      category: { include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  // Filtered here rather than at the page, so a draft/pending/rejected
  // listing can never be cached under this key and then served to a
  // consumer if the page's own status check is ever dropped.
  if (!listing || listing.status !== "published") return null;
  return {
    ...listing,
    price: Number(listing.price),
    attributes: listing.attributes as Record<string, unknown>,
  };
}

/**
 * The listing detail page's own read. It was the last uncached catalog
 * query left, and it showed: every /listing/[id] view paid a full remote
 * round-trip to Supabase (~1.5s from here) that repeat views never
 * amortised, while the fully-cached /explore pages served in ~0.25s.
 */
export const getListingDetail = unstable_cache(readListingDetail, ["listing-detail"], {
  tags: [CATALOG_TAG],
  revalidate: CATALOG_TTL_SECONDS,
});

export const getListingsByIds = unstable_cache(
  async (ids: string[]): Promise<ListingDTO[]> => {
    const listings = await prisma.listing.findMany({
      where: { id: { in: ids }, status: "published" },
      include: { provider: true },
    });
    return listings.map(toListingDTO);
  },
  ["listings-by-ids"],
  { tags: [CATALOG_TAG], revalidate: CATALOG_TTL_SECONDS },
);

/**
 * "Others also compared" — the Amazon-style social-proof pattern named in
 * the build plan but never implemented. Scans recent Comparison rows that
 * included this listing, tallies which other listings showed up alongside
 * it most often, and returns the top few in rank order. No separate
 * aggregation table — computed from Comparison rows that already exist.
 */
export const getAlsoCompared = unstable_cache(
  async (listingId: string, limit = 4): Promise<ListingDTO[]> => {
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
  },
  ["also-compared"],
  // A 200-row scan plus an in-memory tally on every listing page view. The
  // ranking is a popularity signal, so serving it a few minutes stale is
  // indistinguishable from fresh to a user.
  { tags: [CATALOG_TAG], revalidate: CATALOG_TTL_SECONDS },
);

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
 * no separate aggregation tables. Pass sectorSlug to drill down into a
 * single sector (the "Explore" stage) instead of the full market.
 */
export const getMarketOverview = unstable_cache(
  async (sectorSlug?: string): Promise<MarketOverview> => {
    const rows = await prisma.listing.findMany({
      where: {
        status: "published",
        category: { sector: { status: "live", ...(sectorSlug ? { slug: sectorSlug } : {}) } },
      },
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
  },
  ["market-overview"],
  // The single heaviest query in the app: every published listing in every
  // live sector, plus their price history. Both dashboards that call it
  // render nothing until it returns.
  { tags: [CATALOG_TAG, PRICE_HISTORY_TAG], revalidate: CATALOG_TTL_SECONDS },
);
