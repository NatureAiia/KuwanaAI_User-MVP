import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { isLowerBetterAttribute } from "@/lib/attributeDirection";
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
 * Picks which comparable numeric attribute stands in as "the benefit" for a
 * category, and which direction counts as better. Prefers the first
 * genuinely higher-is-better field (interest rate, coverage amount, branch
 * count, ...) over a lower-is-better one (monthly fee, excess, ...) — a
 * schema's first comparable field is often a cost figure that already
 * duplicates what `price` captures, so blindly taking "first" and assuming
 * higher-is-better would score the priciest listing as the best one. Only
 * falls back to a lower-is-better field when the category has no
 * higher-is-better candidate at all.
 */
function pickBenefitField(
  attributeSchema: AttributeSchemaFieldDTO[],
): { field: AttributeSchemaFieldDTO; lowerIsBetter: boolean } | null {
  const comparableNumeric = attributeSchema.filter((a) => a.dataType === "number" && a.isComparable && a.key !== "price");
  const higherIsBetter = comparableNumeric.find((a) => !isLowerBetterAttribute(a.key));
  const field = higherIsBetter ?? comparableNumeric[0];
  return field ? { field, lowerIsBetter: isLowerBetterAttribute(field.key) } : null;
}

/**
 * Decision Score: a transparent price/benefit blend — price (lower is
 * better) blended with a comparable numeric "benefit" attribute, when the
 * category has one, oriented in whichever direction is actually better for
 * that attribute (see pickBenefitField) — broken into named components plus
 * three extra signals: listing freshness, recent price trend, and provider
 * trust. Only ever combines fields already on the listing record; not an
 * invented statistic.
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

  const benefit = pickBenefitField(attributeSchema);
  const benefitValues = benefit
    ? listings.map((l) => Number(l.attributes[benefit.field.key])).filter((v) => !Number.isNaN(v))
    : [];
  const benefitMin = benefitValues.length ? Math.min(...benefitValues) : 0;
  const benefitMax = benefitValues.length ? Math.max(...benefitValues) : 0;

  const breakdowns: Record<string, DecisionScoreBreakdown> = {};
  for (const listing of listings) {
    const priceScore = normalize(listing.price, priceMin, priceMax, true);

    let benefitScore: number | null = null;
    if (benefit) {
      const benefitValue = Number(listing.attributes[benefit.field.key]);
      benefitScore = Number.isNaN(benefitValue)
        ? null
        : normalize(benefitValue, benefitMin, benefitMax, benefit.lowerIsBetter);
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

export function scoreListing(footprint: unknown, listingAttributes: Record<string, number | undefined>) {
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

