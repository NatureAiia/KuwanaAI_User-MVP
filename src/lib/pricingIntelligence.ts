import { prisma } from "@/lib/prisma";
import { generateAiJson } from "@/lib/ai/provider";

/**
 * "Fee comparison" / "revenue leakage" / "anomaly detection" reinterpreted
 * onto Kuwana's actual data: there is no transaction ledger, only listed
 * prices. A listing's price is "anomalous" when it sits far from its
 * category peers' price distribution, and "leaking" when it sits suspiciously
 * below the peer median — both statistical signals, not real margin data.
 * See the "Porting a Revenue-Assurance Feature Set" plan for the full
 * concept-mapping rationale.
 */

export type PeerPriceStats = {
  medianPrice: number;
  meanPrice: number;
  stdDev: number;
  sampleSize: number;
};

// Below this many published listings in a category, a z-score is noise, not
// signal — mirrors MIN_LISTINGS_FOR_MEDIAN's reasoning in catalog.ts.
const MIN_SAMPLE_FOR_OUTLIER = 5;
const OUTLIER_Z_THRESHOLD = 2;
const BELOW_MEDIAN_RATIO = 0.9;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeStats(prices: number[]): PeerPriceStats {
  const sampleSize = prices.length;
  if (sampleSize === 0) return { medianPrice: 0, meanPrice: 0, stdDev: 0, sampleSize: 0 };

  const meanPrice = prices.reduce((sum, p) => sum + p, 0) / sampleSize;
  const variance = prices.reduce((sum, p) => sum + (p - meanPrice) ** 2, 0) / sampleSize;

  return {
    medianPrice: Math.round(median(prices) * 100) / 100,
    meanPrice: Math.round(meanPrice * 100) / 100,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
    sampleSize,
  };
}

/** Peer price distribution for every published listing in a category. */
export async function getPeerPriceStats(categoryId: string): Promise<PeerPriceStats> {
  const listings = await prisma.listing.findMany({
    where: { categoryId, status: "published" },
    select: { price: true },
  });
  return computeStats(listings.map((l) => Number(l.price)));
}

export type OutlierScore = { zScore: number; isOutlier: boolean };

/**
 * How far a price sits from its category peers. `isOutlier` requires both a
 * large enough sample (see MIN_SAMPLE_FOR_OUTLIER) and a meaningful spread
 * (stdDev > 0) — a category with one price point or a uniform price has no
 * outliers by definition, not every listing at once.
 */
export function computeOutlierScore(price: number, stats: PeerPriceStats): OutlierScore {
  if (stats.sampleSize < MIN_SAMPLE_FOR_OUTLIER || stats.stdDev === 0) {
    return { zScore: 0, isOutlier: false };
  }
  const zScore = Math.round(((price - stats.meanPrice) / stats.stdDev) * 100) / 100;
  return { zScore, isOutlier: Math.abs(zScore) > OUTLIER_Z_THRESHOLD };
}

export type ProviderFeeComparison = {
  listingId: string;
  listingName: string;
  categoryName: string;
  price: number;
  currency: string;
  peerMedian: number;
  sampleSize: number;
  zScore: number;
  isOutlier: boolean;
};

/**
 * A provider's own published listings against their category peer median —
 * the corporate-portal "fee comparison" panel. One getPeerPriceStats call
 * per distinct category among the provider's listings, not per listing.
 */
export async function getProviderFeeComparison(providerId: string): Promise<ProviderFeeComparison[]> {
  const myListings = await prisma.listing.findMany({
    where: { providerId, status: "published" },
    include: { category: true },
  });
  if (myListings.length === 0) return [];

  const statsByCategory = new Map<string, PeerPriceStats>();
  const results: ProviderFeeComparison[] = [];

  for (const listing of myListings) {
    let stats = statsByCategory.get(listing.categoryId);
    if (!stats) {
      stats = await getPeerPriceStats(listing.categoryId);
      statsByCategory.set(listing.categoryId, stats);
    }
    const price = Number(listing.price);
    const { zScore, isOutlier } = computeOutlierScore(price, stats);
    results.push({
      listingId: listing.id,
      listingName: listing.name,
      categoryName: listing.category.name,
      price,
      currency: listing.currency,
      peerMedian: stats.medianPrice,
      sampleSize: stats.sampleSize,
      zScore,
      isOutlier,
    });
  }

  return results;
}

export type PricingOutlier = {
  listingId: string;
  listingName: string;
  price: number;
  currency: string;
  providerName: string;
  categoryId: string;
  categoryName: string;
  sectorSlug: string;
  sectorName: string;
  zScore: number;
  belowPeerMedian: boolean;
};

export type SectorPricingSummary = {
  sectorSlug: string;
  sectorName: string;
  listingCount: number;
  outlierCount: number;
  belowPeerMedianCount: number;
};

export type PricingIntelligenceReport = {
  bySector: SectorPricingSummary[];
  outliers: PricingOutlier[];
};

// "Worth a look" cap, same reasoning as getMarketOverview's anomalies.slice(0, 25).
const MAX_OUTLIERS_RETURNED = 50;

/**
 * Sector-wide outlier/leakage rollup — one pass over every published
 * listing, peer stats computed per category so a thin category doesn't
 * drown out a thick one. Pass sectorSlug to scope to a single sector (used
 * by the corporate fee-comparison panel); omit for the admin-wide view.
 */
export async function getSectorPricingSummary(sectorSlug?: string): Promise<PricingIntelligenceReport> {
  const rows = await prisma.listing.findMany({
    where: {
      status: "published",
      category: { sector: { status: "live", ...(sectorSlug ? { slug: sectorSlug } : {}) } },
    },
    include: { provider: true, category: { include: { sector: true } } },
  });

  const byCategory = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = byCategory.get(row.categoryId) ?? [];
    group.push(row);
    byCategory.set(row.categoryId, group);
  }

  const sectorMap = new Map<string, SectorPricingSummary>();
  const outliers: PricingOutlier[] = [];

  for (const categoryRows of byCategory.values()) {
    const stats = computeStats(categoryRows.map((r) => Number(r.price)));

    for (const row of categoryRows) {
      const price = Number(row.price);
      const { zScore, isOutlier } = computeOutlierScore(price, stats);
      const belowPeerMedian = stats.sampleSize >= MIN_SAMPLE_FOR_OUTLIER && price < stats.medianPrice * BELOW_MEDIAN_RATIO;

      const sSlug = row.category.sector.slug;
      const entry = sectorMap.get(sSlug) ?? {
        sectorSlug: sSlug,
        sectorName: row.category.sector.name,
        listingCount: 0,
        outlierCount: 0,
        belowPeerMedianCount: 0,
      };
      entry.listingCount += 1;
      if (isOutlier) entry.outlierCount += 1;
      if (belowPeerMedian) entry.belowPeerMedianCount += 1;
      sectorMap.set(sSlug, entry);

      if (isOutlier) {
        outliers.push({
          listingId: row.id,
          listingName: row.name,
          price,
          currency: row.currency,
          providerName: row.provider.name,
          categoryId: row.categoryId,
          categoryName: row.category.name,
          sectorSlug: sSlug,
          sectorName: row.category.sector.name,
          zScore,
          belowPeerMedian,
        });
      }
    }
  }

  outliers.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

  return { bySector: [...sectorMap.values()], outliers: outliers.slice(0, MAX_OUTLIERS_RETURNED) };
}

export type SectorNarrative = { headline: string; insights: string[] };

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    insights: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
  required: ["headline", "insights"],
  additionalProperties: false,
};

/**
 * AI-generated "why this looks worth checking" prose for a sector's outlier
 * signal. The heuristic above already decided which listings are outliers;
 * this only explains them in plain language, and never invents a number it
 * wasn't given. Returns null (rather than throwing) on any AI failure so a
 * narrative outage never breaks the underlying admin page.
 */
export async function generateSectorNarrative(
  summary: SectorPricingSummary,
  outliers: PricingOutlier[],
): Promise<SectorNarrative | null> {
  if (summary.listingCount === 0) return null;

  try {
    return await generateAiJson<SectorNarrative>({
      feature: "pricing_intelligence_narrative",
      signals: {
        feature: "pricing_intelligence_narrative",
        outlierCount: summary.outlierCount,
        listingCount: summary.listingCount,
      },
      system:
        "You are a pricing analyst summarizing statistical pricing signals for an internal admin dashboard. " +
        "Be concise and factual. Only reference numbers given to you in the prompt — never invent a price, " +
        "provider name, or percentage that isn't present in the data.",
      prompt: JSON.stringify({
        sector: summary.sectorName,
        listingCount: summary.listingCount,
        outlierCount: summary.outlierCount,
        belowPeerMedianCount: summary.belowPeerMedianCount,
        topOutliers: outliers
          .filter((o) => o.sectorSlug === summary.sectorSlug)
          .slice(0, 5)
          .map((o) => ({
            listing: o.listingName,
            provider: o.providerName,
            category: o.categoryName,
            price: o.price,
            currency: o.currency,
            zScore: o.zScore,
            belowPeerMedian: o.belowPeerMedian,
          })),
      }),
      schema: NARRATIVE_SCHEMA,
      schemaName: "sector_pricing_narrative",
      maxTokens: 400,
      effort: "low",
    });
  } catch (err) {
    console.error("[pricingIntelligence] narrative generation failed:", err);
    return null;
  }
}
