<<<<<<< HEAD
import { prisma } from "@/lib/prisma";
import { computeDecisionScores } from "@/lib/scoring";
import { findClosestMatches } from "@/lib/similarListings";
import { computePriceTrend, type PriceTrend } from "@/lib/priceTrend";
import type { CategoryDTO, CategoryWithListingsDTO, ListingDTO } from "@/types/catalog";
=======
/**
 * src/lib/catalog.ts
 * Single published-filtering gateway for all consumer-facing reads
 * Principle: Every consumer query MUST filter Listing.status = 'published'
 */
import { prisma } from './prisma'
import { ListingStatus, Prisma } from '@prisma/client'
>>>>>>> 3abce5db13eb9afe69cb0f62e1578304aa84aa9d

const PUBLISHED: Prisma.ListingWhereInput = { status: ListingStatus.PUBLISHED }

type ListOptions = {
  sectorSlug?: string
  categorySlug?: string
  providerSlug?: string
  search?: string
  take?: number
  skip?: number
}

export async function getPublishedListings(opts: ListOptions = {}) {
  const where: Prisma.ListingWhereInput = { ...PUBLISHED }

  if (opts.sectorSlug) {
    where.sector = { slug: opts.sectorSlug }
  }
  if (opts.categorySlug) {
    where.category = { slug: opts.categorySlug }
  }
  if (opts.providerSlug) {
    where.provider = { slug: opts.providerSlug }
  }
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: 'insensitive' } },
      { description: { contains: opts.search, mode: 'insensitive' } },
    ]
  }

  return prisma.listing.findMany({
    where,
    include: {
      provider: true,
      category: { include: { sector: true } },
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 1 },
    },
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getListingById(id: string) {
  return prisma.listing.findFirst({
    where: { id, ...PUBLISHED },
    include: {
      provider: true,
      category: { include: { attributeSchemas: { orderBy: { order: 'asc' } }, sector: true } },
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 90 },
    },
  })
}

export async function getSectorsWithCategories() {
  return prisma.sectorConfig.findMany({
    where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
    include: {
      categories: {
        include: { attributeSchemas: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })
}

export async function getAttributeSchemaForCategory(categoryId: string) {
  return prisma.attributeSchemaField.findMany({
    where: { categoryId },
    orderBy: { order: 'asc' },
  })
}

// Comparison scoring stub - actual scoring in src/lib/scoring.ts
export async function scoreListingsForUser(userId: string, listingIds: string[]) {
  const footprint = await prisma.sectorFootprint.findMany({ where: { userId } })
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, ...PUBLISHED },
    include: { category: true, provider: true },
  })
  // scoring delegated to app-layer zod-validated logic
  return { footprint, listings }
}

// Price history with FX override - never delete fallback
export async function getLatestFxRate(base: string, target: string) {
  const latest = await prisma.fxRate.findFirst({
    where: { baseCurrency: base, targetCurrency: target },
    orderBy: { effectiveAt: 'desc' },
  })
  return latest?.rate ?? null // fallback table in app layer
}

<<<<<<< HEAD
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

/**
 * Cross-provider substitutes for one listing, ranked by comparable-attribute
 * closeness rather than usage history — available immediately (unlike
 * getAlsoCompared, which needs real Comparison rows to exist first) since it's
 * computed straight from the category's own AttributeSchemaFields. See
 * findClosestMatches in similarListings.ts for the scoring itself.
 */
export async function getClosestMatches(listingId: string, limit = 3): Promise<ListingDTO[]> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      provider: true,
      category: { include: { attributeSchema: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!listing) return [];

  const siblings = await prisma.listing.findMany({
    where: { categoryId: listing.categoryId, status: "published", id: { not: listingId } },
    include: { provider: true },
  });

  const attributeSchema = listing.category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  const matches = findClosestMatches(toListingDTO(listing), siblings.map(toListingDTO), attributeSchema, limit);
  return matches.map((m) => m.listing);
}

export type TrendingListing = { listing: ListingDTO; comparisonCount: number };

/**
 * "127 people compared this this week" style social-proof signal — real
 * comparison volume in the trailing window, never invented. Same
 * tally-over-Comparison-rows approach as getAlsoCompared, but time-windowed
 * and ranked across a sector rather than scoped to one listing's neighbors.
 */
export async function getTrendingListings(
  sectorSlug?: string,
  limit = 6,
  windowDays = 7,
): Promise<TrendingListing[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const comparisons = await prisma.comparison.findMany({
    where: {
      createdAt: { gte: since },
      ...(sectorSlug ? { category: { sector: { slug: sectorSlug } } } : {}),
    },
    select: { listingIds: true },
  });

  const counts = new Map<string, number>();
  for (const comparison of comparisons) {
    for (const id of comparison.listingIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const rankedIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (rankedIds.length === 0) return [];

  const listings = await getListingsByIds(rankedIds);
  const byId = new Map(listings.map((l) => [l.id, l]));
  return rankedIds
    .map((id) => byId.get(id))
    .filter((l): l is ListingDTO => !!l)
    .map((listing) => ({ listing, comparisonCount: counts.get(listing.id)! }));
}

export type ProviderListingStats = { comparisonAppearances: number; savedCount: number };

/**
 * Provider-facing interest signals, sourced entirely from data that already
 * exists (Comparison/SavedListing) — no new tracking. Deliberately doesn't
 * report a "views" count: nothing in this app tracks a per-listing page
 * view today (see EventType in schema.prisma), and inventing one would be
 * exactly the kind of number this project's design brief forbids.
 */
export async function getProviderListingStats(
  listingIds: string[],
): Promise<Record<string, ProviderListingStats>> {
  const stats: Record<string, ProviderListingStats> = Object.fromEntries(
    listingIds.map((id) => [id, { comparisonAppearances: 0, savedCount: 0 }]),
  );
  if (listingIds.length === 0) return stats;

  const [comparisons, savedCounts] = await Promise.all([
    prisma.comparison.findMany({ where: { listingIds: { hasSome: listingIds } }, select: { listingIds: true } }),
    prisma.savedListing.groupBy({ by: ["listingId"], where: { listingId: { in: listingIds } }, _count: true }),
  ]);

  for (const comparison of comparisons) {
    for (const id of comparison.listingIds) {
      if (id in stats) stats[id].comparisonAppearances += 1;
    }
  }
  for (const row of savedCounts) {
    if (row.listingId in stats) stats[row.listingId].savedCount = row._count;
  }

  return stats;
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
 * no separate aggregation tables. Pass sectorSlug to drill down into a
 * single sector (the "Explore" stage) instead of the full market.
 */
export async function getMarketOverview(sectorSlug?: string): Promise<MarketOverview> {
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
    // 25, not the whole set — this is "biggest swings worth a look", not a
    // full history. Regulator's compliance trail (getComplianceActivity,
    // below) is the actual full-history view.
    anomalies: anomalies.slice(0, 25),
    unverifiedListings,
  };
}

export type ComplianceActivity = {
  listing: ListingDTO;
  sectorName: string;
  categoryName: string;
  rejectionReason: string | null;
  // lastVerifiedAt, not a dedicated rejectedAt column — admin's reject
  // action bumps lastVerifiedAt (markVerifiedNow defaults true on any admin
  // edit, see /api/admin/listings/[id]), so this is an accurate proxy for
  // "when this rejection happened" without needing a schema change.
  rejectedAt: string;
};

/**
 * Regulator-facing compliance trail: every currently-rejected listing, most
 * recent first — the actual audit-trail feature HANDOFF.md's "no audit log
 * for Regulator" gap was about. Computed straight from Listing.status,
 * nothing invented or separately tracked.
 */
export async function getComplianceActivity(sectorSlug?: string, limit = 50): Promise<ComplianceActivity[]> {
  const rows = await prisma.listing.findMany({
    where: {
      status: "rejected",
      category: { sector: { status: "live", ...(sectorSlug ? { slug: sectorSlug } : {}) } },
    },
    include: { provider: true, category: { include: { sector: true } } },
    orderBy: { lastVerifiedAt: "desc" },
=======
// Social intelligence feed
export async function getSocialMentionsForProvider(providerName: string, limit = 20) {
  return prisma.socialPriceMention.findMany({
    where: { matchedProvider: providerName },
    orderBy: { createdAt: 'desc' },
>>>>>>> 3abce5db13eb9afe69cb0f62e1578304aa84aa9d
    take: limit,
  })
}

// Admin-only write path - enforced via requireAdmin() checking ADMIN_EMAILS allowlist
export const AdminWrite = {
  async publishListing(id: string) {
    // Zod in route should enforce draft/pending_review -> published only via admin
    return prisma.listing.update({ where: { id }, data: { status: 'PUBLISHED' } })
  },
  async rejectListing(id: string) {
    return prisma.listing.update({ where: { id }, data: { status: 'REJECTED' } })
  },
}
