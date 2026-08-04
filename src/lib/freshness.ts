import type { FreshnessStatus } from "@prisma/client";

// The age ladder scoring.ts penalizes against (freshnessAdjustment: fresh 0,
// stale -6, unverified -12) — kept here so the decay job and the score
// explanation stay talking about the same thresholds.
export const FRESH_WITHIN_DAYS = 14;
export const STALE_WITHIN_DAYS = 45;

/** Recomputes freshness from how long ago a listing was last verified. */
export function computeFreshnessStatus(lastVerifiedAt: Date, now: Date = new Date()): FreshnessStatus {
  const ageDays = (now.getTime() - lastVerifiedAt.getTime()) / 86_400_000;
  if (ageDays <= FRESH_WITHIN_DAYS) return "fresh";
  if (ageDays <= STALE_WITHIN_DAYS) return "stale";
  return "unverified";
}
