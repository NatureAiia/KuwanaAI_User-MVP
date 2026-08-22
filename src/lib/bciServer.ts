import type { QualityAxis } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import {
  QUALITY_AXES,
  DEFAULT_AXIS_WEIGHTS,
  computeAxisObjectiveScores,
  computeBci,
  type AxisRatingStats,
  type BciResult,
} from "@/lib/bci";

/**
 * Server-only half of the BCI engine — the DB-backed rating fetch and the
 * async orchestrator that combines it with bci.ts's pure functions. Kept
 * out of bci.ts itself so a client component can import the pure pieces
 * (as CompareClient.tsx does for its weight sliders) without pulling the
 * `pg` driver into the browser bundle.
 */

const NEUTRAL_SCORE = 50;

/**
 * Batched subjective-input fetch — one grouped query for every listing in
 * the set, not N+1 per listing. Rescales the 1-5 Likert average to 0-100 so
 * it's directly comparable to (and blendable with) the objective score.
 */
export async function fetchAxisRatingStats(
  listingIds: string[],
): Promise<Record<string, Record<QualityAxis, AxisRatingStats>>> {
  const empty = () =>
    Object.fromEntries(QUALITY_AXES.map((axis) => [axis, { avg: null, count: 0 }])) as Record<
      QualityAxis,
      AxisRatingStats
    >;
  const result: Record<string, Record<QualityAxis, AxisRatingStats>> = Object.fromEntries(
    listingIds.map((id) => [id, empty()]),
  );
  if (listingIds.length === 0) return result;

  const grouped = await prisma.listingQualityRating.groupBy({
    by: ["listingId", "axis"],
    where: { listingId: { in: listingIds } },
    _avg: { score: true },
    _count: { score: true },
  });

  for (const row of grouped) {
    result[row.listingId][row.axis] = {
      avg: row._avg.score !== null ? ((row._avg.score - 1) / 4) * 100 : null,
      count: row._count.score,
    };
  }
  return result;
}

/**
 * Orchestrates the full BCI computation for a set of listings within one
 * category: objective scores (sync), a single batched ratings query, then
 * the per-listing composite. `weights` lets flow 2's draggable 0-100
 * sliders override the seeded QualityAxisConfig defaults for one request
 * without persisting anything.
 */
export async function computeBciForListings(
  listings: ListingDTO[],
  schema: AttributeSchemaFieldDTO[],
  options: { trends?: Record<string, PriceTrend | null>; weights?: Record<QualityAxis, number> } = {},
): Promise<Record<string, BciResult>> {
  if (listings.length === 0) return {};

  const objectiveByAxisByListing = computeAxisObjectiveScores(listings, schema, options.trends ?? {});
  const ratingStats = await fetchAxisRatingStats(listings.map((l) => l.id));

  const results: Record<string, BciResult> = {};
  for (const listing of listings) {
    const objectiveByAxis = Object.fromEntries(
      QUALITY_AXES.map((axis) => [axis, objectiveByAxisByListing[axis][listing.id] ?? NEUTRAL_SCORE]),
    ) as Record<QualityAxis, number>;
    results[listing.id] = computeBci(objectiveByAxis, ratingStats[listing.id], options.weights ?? DEFAULT_AXIS_WEIGHTS);
  }
  return results;
}
