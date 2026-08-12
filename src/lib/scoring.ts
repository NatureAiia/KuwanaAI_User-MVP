import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { z } from "zod";

export function normalize(value: number, min: number, max: number, invert: boolean) {
  if (max === min) return 100;
  const t = (value - min) / (max - min);
  return Math.round((invert ? 1 - t : t) * 100);
}

export const DECISION_SCORE_VERSIONS = {
  v1: {
    defaultPriceWeight: 0.5,
    freshnessAdjustment: { fresh: 0, stale: -6, unverified: -12 } as Record<ListingDTO["freshnessStatus"], number>,
    maxTrendAdjustment: 5,
    unverifiedProviderAdjustment: -8,
  },
} as const;

export const CURRENT_DECISION_SCORE_VERSION: keyof typeof DECISION_SCORE_VERSIONS = "v1";

export type DecisionScoreBreakdown = {
  /** 0-100 final score: price/benefit blend plus freshness, trend, and trust adjustments, clamped. */
  total: number;
  priceScore: number;
  benefitScore: number | null;
  /** Small penalty for stale/unverified listings; 0 for fresh. */
  freshnessAdjustment: number;
  /** Small bonus if the price has been trending down, penalty if trending up; 0 if flat/unknown. */
  trendAdjustment: number;
  /** Small penalty if the listing's provider isn't verified; 0 if verified. */
  trustAdjustment: number;
  /** Which DECISION_SCORE_VERSIONS entry produced this breakdown. */
  version: string;
};

/**
 * Decision Score: a transparent price/benefit blend — price (lower is
 * better) blended with the first comparable numeric "benefit" attribute
 * (higher is better), when the category has one — broken into named
 * components plus three extra signals: listing freshness, recent price
 * trend, and provider trust. Only ever combines fields already on the
 * listing record; not an invented statistic.
 */
export function computeDecisionScores(
  listings: ListingDTO[],
  attributeSchema: AttributeSchemaFieldDTO[],
  trends: Record<string, PriceTrend | null> = {},
  priceWeight?: number,
  version: keyof typeof DECISION_SCORE_VERSIONS = CURRENT_DECISION_SCORE_VERSION,
): Record<string, DecisionScoreBreakdown> {
  if (listings.length === 0) return {};

  const config = DECISION_SCORE_VERSIONS[version];
  const effectivePriceWeight = priceWeight ?? config.defaultPriceWeight;

  const prices = listings.map((l) => l.price);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);

  const benefitField = attributeSchema.find(
    (a) => a.dataType === "number" && a.isComparable && a.key !== "price",
  );
  const benefitValues = benefitField
    ? listings.map((l) => Number(l.attributes[benefitField.key])).filter((v) => !Number.isNaN(v))
    : [];
  const benefitMin = benefitValues.length ? Math.min(...benefitValues) : 0;
  const benefitMax = benefitValues.length ? Math.max(...benefitValues) : 0;

  const breakdowns: Record<string, DecisionScoreBreakdown> = {};
  for (const listing of listings) {
    const priceScore = normalize(listing.price, priceMin, priceMax, true);

    let benefitScore: number | null = null;
    if (benefitField) {
      const benefitValue = Number(listing.attributes[benefitField.key]);
      benefitScore = Number.isNaN(benefitValue) ? null : normalize(benefitValue, benefitMin, benefitMax, false);
    }

    const baseScore =
      benefitScore === null
        ? priceScore
        : priceScore * effectivePriceWeight + benefitScore * (1 - effectivePriceWeight);

    const freshnessAdjustment = config.freshnessAdjustment[listing.freshnessStatus] ?? 0;
    const trustAdjustment = listing.provider.verified ? 0 : config.unverifiedProviderAdjustment;

    const trend = trends[listing.id];
    const trendAdjustment =
      !trend || trend.direction === "flat"
        ? 0
        : Math.min(config.maxTrendAdjustment, Math.round(Math.abs(trend.changePercent) / 4)) *
          (trend.direction === "down" ? 1 : -1);

    breakdowns[listing.id] = {
      total: Math.max(
        0,
        Math.min(100, Math.round(baseScore + freshnessAdjustment + trendAdjustment + trustAdjustment)),
      ),
      priceScore: Math.round(priceScore),
      benefitScore: benefitScore === null ? null : Math.round(benefitScore),
      freshnessAdjustment,
      trendAdjustment,
      trustAdjustment,
      version,
    };
  }
  return breakdowns;
}

// Example: telecom scoring based on footprint
const TelecomFootprint = z.object({
  monthly_budget_usd: z.number().min(0),
  data_need_gb: z.number().min(0),
  network_preference: z.enum(["Econet", "NetOne", "Telecel", "Any"]).optional(),
});

export function scoreListing(footprint: unknown, listingAttributes: Record<string, any>) {
  const parsed = TelecomFootprint.safeParse(footprint);
  if (!parsed.success) return { score: 0, reason: "footprint invalid" };

  const { monthly_budget_usd, data_need_gb } = parsed.data;
  const price = listingAttributes.price_usd ?? listingAttributes.monthly_usd ?? 999;
  const gb = listingAttributes.data_gb ?? 0;

  let score = 100;
  if (price > monthly_budget_usd) score -= 30;
  if (gb < data_need_gb) score -= 40;
  if (price <= monthly_budget_usd && gb >= data_need_gb) score += 10;

  return { score: Math.max(0, Math.min(100, score)), breakdown: { price, gb, budget: monthly_budget_usd, need: data_need_gb } };
}

