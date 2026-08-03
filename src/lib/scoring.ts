import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";

function normalize(value: number, min: number, max: number, invert: boolean) {
  if (max === min) return 100;
  const t = (value - min) / (max - min);
  return Math.round((invert ? 1 - t : t) * 100);
}

/**
 * Derives a 0–100 "value score" per listing from real seeded attributes —
 * price (lower is better) blended with the first comparable numeric
 * "benefit" attribute (higher is better), when the category has one.
 * This is a simple, transparent heuristic, not an invented statistic: it
 * only ever combines fields already on the listing record (Section 9).
 *
 * `priceWeight` (default 0.5) lets callers bias the price/benefit split —
 * e.g. a footprint indicating low spend weights price higher than the
 * default 50/50 split (see getPersonalizedSpecials in catalog.ts).
 */
export function computeValueScores(
  listings: ListingDTO[],
  attributeSchema: AttributeSchemaFieldDTO[],
  priceWeight = 0.5,
): Record<string, number> {
  if (listings.length === 0) return {};

  const prices = listings.map((l) => l.price);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);

  const benefitField = attributeSchema.find(
    (a) => a.dataType === "number" && a.isComparable && a.key !== "price",
  );

  const scores: Record<string, number> = {};
  for (const listing of listings) {
    const priceScore = normalize(listing.price, priceMin, priceMax, true);

    if (!benefitField) {
      scores[listing.id] = priceScore;
      continue;
    }

    const benefitValues = listings
      .map((l) => Number(l.attributes[benefitField.key]))
      .filter((v) => !Number.isNaN(v));
    const benefitMin = Math.min(...benefitValues);
    const benefitMax = Math.max(...benefitValues);
    const benefitValue = Number(listing.attributes[benefitField.key]);
    const benefitScore = Number.isNaN(benefitValue)
      ? priceScore
      : normalize(benefitValue, benefitMin, benefitMax, false);

    scores[listing.id] = Math.round(priceScore * priceWeight + benefitScore * (1 - priceWeight));
  }
  return scores;
}

export type DecisionScoreBreakdown = {
  /** 0-100 final score: price/benefit blend plus freshness and trend adjustments, clamped. */
  total: number;
  priceScore: number;
  benefitScore: number | null;
  /** Small penalty for stale/unverified listings; 0 for fresh. */
  freshnessAdjustment: number;
  /** Small bonus if the price has been trending down, penalty if trending up; 0 if flat/unknown. */
  trendAdjustment: number;
};

const FRESHNESS_ADJUSTMENT: Record<ListingDTO["freshnessStatus"], number> = {
  fresh: 0,
  stale: -6,
  unverified: -12,
};

const MAX_TREND_ADJUSTMENT = 5;

/**
 * Decision Score: the same transparent price/benefit blend as
 * computeValueScores, broken into named components plus two extra signals —
 * listing freshness and recent price trend — so the "why" behind a number
 * is inspectable rather than a single opaque figure.
 */
export function computeDecisionScores(
  listings: ListingDTO[],
  attributeSchema: AttributeSchemaFieldDTO[],
  trends: Record<string, PriceTrend | null> = {},
  priceWeight = 0.5,
): Record<string, DecisionScoreBreakdown> {
  if (listings.length === 0) return {};

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
      benefitScore === null ? priceScore : priceScore * priceWeight + benefitScore * (1 - priceWeight);

    const freshnessAdjustment = FRESHNESS_ADJUSTMENT[listing.freshnessStatus] ?? 0;

    const trend = trends[listing.id];
    const trendAdjustment =
      !trend || trend.direction === "flat"
        ? 0
        : Math.min(MAX_TREND_ADJUSTMENT, Math.round(Math.abs(trend.changePercent) / 4)) *
          (trend.direction === "down" ? 1 : -1);

    breakdowns[listing.id] = {
      total: Math.max(0, Math.min(100, Math.round(baseScore + freshnessAdjustment + trendAdjustment))),
      priceScore: Math.round(priceScore),
      benefitScore: benefitScore === null ? null : Math.round(benefitScore),
      freshnessAdjustment,
      trendAdjustment,
    };
  }
  return breakdowns;
}
