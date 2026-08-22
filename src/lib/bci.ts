import type { QualityAxis } from "@prisma/client";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import { normalize, computeDecisionScores } from "@/lib/scoring";
import { isLowerBetterAttribute } from "@/lib/attributeDirection";
import type { PriceTrend } from "@/lib/priceTrend";

/**
 * BCI ("Business Comparison Index") — the 5-axis composite ranking score
 * (Value/Trust/Availability/Performance/Resilience) from the uploaded
 * 7-sector docs, adapted onto this app's existing catalog rather than a
 * separate schema. Sits beside src/lib/scoring.ts's Decision Score (still
 * used everywhere it already is — chat grounding, recommendations, PDF
 * export) rather than replacing it: BCI is additive, used specifically by
 * the Ranking Engine (Quick Search) and the weighted product-vs-product
 * comparison flow.
 *
 * Deliberately no `@/lib/prisma` import here — this file is pure/sync and
 * safe to import from a client component (CompareClient.tsx does, for the
 * weight sliders). The DB-backed pieces (rating fetch, the async
 * orchestrator) live in bciServer.ts instead; importing prisma (which pulls
 * in the `pg` driver) from here would leak a server-only dependency into the
 * client bundle.
 */

export const QUALITY_AXES: QualityAxis[] = ["value", "trust", "availability", "performance", "resilience"];

// 25/25/20/15/15 — the docs' own default split. Mirrors the seeded
// QualityAxisConfig.defaultWeight rows (see prisma/seed.ts); callers that
// already loaded QualityAxisConfig from the DB should pass those instead.
export const DEFAULT_AXIS_WEIGHTS: Record<QualityAxis, number> = {
  value: 0.25,
  trust: 0.25,
  availability: 0.2,
  performance: 0.15,
  resilience: 0.15,
};

// Fewer than this many ratings on an axis is "low confidence" — the axis
// falls back to its objective score alone instead of blending in a
// statistically shaky average of 1-4 opinions. Matches the docs'
// `rating_count < 5` rule verbatim.
const MIN_RATINGS_FOR_CONFIDENCE = 5;
const OBJECTIVE_WEIGHT_WHEN_CONFIDENT = 0.4;
const SUBJECTIVE_WEIGHT_WHEN_CONFIDENT = 0.6;

// A category with no field tagged for a given axis contributes this neutral
// midpoint rather than silently skewing the composite toward whichever axes
// happen to have data (see computeAxisObjectiveScores).
const NEUTRAL_SCORE = 50;

export const BCI_VERSION = "v1";

export type AxisBreakdown = {
  objective: number;
  subjective: number | null;
  ratingCount: number;
  /** The number actually folded into the composite — objective alone below MIN_RATINGS_FOR_CONFIDENCE, blended above it. */
  blended: number;
  confidence: "low" | "high";
};

export type BciResult = {
  total: number;
  axisBreakdown: Record<QualityAxis, AxisBreakdown>;
  version: string;
};

/**
 * Per-listing, per-axis objective (0-100) scores for one category's
 * listings. Pure/sync so it's directly unit-testable without a DB.
 *
 * The `value` axis is a special case: rather than re-deriving a second
 * price/benefit blend, it reuses computeDecisionScores() (scoring.ts) —
 * already exactly a normalized price+benefit score — as its objective
 * input, so there's one shared definition of "good value" across the app,
 * not two that can silently drift apart.
 *
 * Every other axis averages the normalized values of whichever
 * AttributeSchemaField rows are tagged with that axis (direction-aware via
 * isLowerBetterAttribute, the same source of truth scoring.ts/
 * traditionalCompare.ts already share) — boolean fields (e.g. one
 * channel_ussd/channel_agency/... column per channel, per the docs'
 * "channel coverage" concept) score true as 100 and false as 0 directly,
 * no min/max normalization needed since they're already binary.
 */
export function computeAxisObjectiveScores(
  listings: ListingDTO[],
  schema: AttributeSchemaFieldDTO[],
  trends: Record<string, PriceTrend | null> = {},
): Record<QualityAxis, Record<string, number>> {
  const result = Object.fromEntries(QUALITY_AXES.map((axis) => [axis, {} as Record<string, number>])) as Record<
    QualityAxis,
    Record<string, number>
  >;

  if (listings.length === 0) return result;

  const valueScores = computeDecisionScores(listings, schema, trends);
  for (const listing of listings) {
    result.value[listing.id] = valueScores[listing.id]?.total ?? NEUTRAL_SCORE;
  }

  for (const axis of QUALITY_AXES) {
    if (axis === "value") continue; // handled above
    const fields = schema.filter((f) => f.qualityAxis === axis && (f.dataType === "number" || f.dataType === "boolean"));
    if (fields.length === 0) {
      for (const l of listings) result[axis][l.id] = NEUTRAL_SCORE;
      continue;
    }

    const perFieldScores: Record<string, number>[] = fields.map((field) => {
      if (field.dataType === "boolean") {
        const out: Record<string, number> = {};
        for (const l of listings) {
          const raw = l.attributes[field.key];
          if (typeof raw === "boolean") out[l.id] = raw ? 100 : 0;
        }
        return out;
      }
      const values = listings.map((l) => Number(l.attributes[field.key])).filter((v) => !Number.isNaN(v));
      if (values.length === 0) return {};
      const min = Math.min(...values);
      const max = Math.max(...values);
      const invert = isLowerBetterAttribute(field.key);
      const out: Record<string, number> = {};
      for (const l of listings) {
        const raw = Number(l.attributes[field.key]);
        if (Number.isNaN(raw)) continue;
        out[l.id] = normalize(raw, min, max, invert);
      }
      return out;
    });

    for (const l of listings) {
      const scores = perFieldScores.map((f) => f[l.id]).filter((v) => v !== undefined);
      result[axis][l.id] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : NEUTRAL_SCORE;
    }
  }

  return result;
}

export type AxisRatingStats = { avg: number | null; count: number };

/** Pure per-listing composite — testable without a DB given precomputed axis inputs. */
export function computeBci(
  objectiveByAxis: Record<QualityAxis, number>,
  ratingsByAxis: Record<QualityAxis, AxisRatingStats>,
  weights: Record<QualityAxis, number> = DEFAULT_AXIS_WEIGHTS,
): BciResult {
  const axisBreakdown = {} as Record<QualityAxis, AxisBreakdown>;
  const weightSum = QUALITY_AXES.reduce((sum, axis) => sum + (weights[axis] ?? 0), 0) || 1;

  let total = 0;
  for (const axis of QUALITY_AXES) {
    const objective = objectiveByAxis[axis] ?? NEUTRAL_SCORE;
    const rating = ratingsByAxis[axis] ?? { avg: null, count: 0 };
    const confidence: AxisBreakdown["confidence"] = rating.count >= MIN_RATINGS_FOR_CONFIDENCE ? "high" : "low";
    const blended =
      confidence === "high" && rating.avg !== null
        ? objective * OBJECTIVE_WEIGHT_WHEN_CONFIDENT + rating.avg * SUBJECTIVE_WEIGHT_WHEN_CONFIDENT
        : objective;

    axisBreakdown[axis] = { objective, subjective: rating.avg, ratingCount: rating.count, blended, confidence };
    total += (blended * (weights[axis] ?? 0)) / weightSum;
  }

  return { total: Math.round(Math.max(0, Math.min(100, total))), axisBreakdown, version: BCI_VERSION };
}
