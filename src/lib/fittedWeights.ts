/**
 * Loads the per-category fitted weights produced by
 * `notebooks/recommendation_engine.py` (Section 5: logistic regression on
 * the user's action_taken / SavedListing history).
 *
 * The artifact lives at `notebooks/data/fitted_weights.json` next to the
 * notebook, which is sandbox-only — the notebook is the training pipeline,
 * the JSON is its output. So this loader is best-effort: it tries a few likely
 * locations relative to `process.cwd()`, returns `null` if the file isn't
 * found, and never throws. The catalog lib falls back to the hand-tuned
 * heuristic when no fit is available, which is the production behavior.
 *
 * Schema (written by the notebook, mirrored here as a structural readonly so
 * the catalog lib can type-check it without a shared codegen step):
 *
 *   {
 *     "<category_slug>": {
 *       "value_score":     <coef>,
 *       "special_bonus":   <coef>,
 *       "freshness_bonus": <coef>,
 *       "trust_bonus":     <coef>,
 *       "trend_feature":   <coef>,
 *       "_intercept":      <intercept>,
 *       "_accuracy":       <in-sample score>
 *     },
 *     ...
 *   }
 *
 * The leading-underscore keys are diagnostic — they're surfaced in the
 * notebook's print output but never consumed by the scoring formula. Per-
 * listing score = _intercept + sum(coef * feature), where the features are
 * computed by the catalog lib exactly the same way the notebook computes
 * them (see `getFavoriteProductSpecials`).
 */
import fs from "node:fs";
import path from "node:path";

export type FittedWeights = {
  value_score: number;
  special_bonus: number;
  freshness_bonus: number;
  trust_bonus: number;
  trend_feature: number;
  _intercept: number;
  _accuracy: number;
};

let cached: { weights: Record<string, FittedWeights>; mtimeMs: number } | null = null;
let warnedMissing = false;

/** Candidate paths, tried in order. Keeps the loader portable across
 *  `next dev` (cwd = repo root) and `next start` (cwd also = repo root) and
 *  `npm --prefix scripts/...` (cwd = scripts/). The first one that exists
 *  wins, the rest are skipped. */
function candidatePaths(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "notebooks", "data", "fitted_weights.json"),
    path.join(cwd, "data", "fitted_weights.json"),
    path.join(cwd, "..", "notebooks", "data", "fitted_weights.json"),
  ];
}

/** Returns `{ weights, mtimeMs }` if the artifact exists and parses, else
 *  `null`. Caches on the first successful read so repeated catalog reads in
 *  one process don't re-stat the file. Re-reads when the file mtime changes
 *  so a fresh notebook run is picked up on the next request. */
export function loadFittedWeights(): { weights: Record<string, FittedWeights>; mtimeMs: number } | null {
  for (const candidate of candidatePaths()) {
    try {
      const stat = fs.statSync(candidate);
      if (cached && cached.mtimeMs === stat.mtimeMs) return cached;
      const raw = fs.readFileSync(candidate, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, FittedWeights>;
      cached = { weights: parsed, mtimeMs: stat.mtimeMs };
      return cached;
    } catch {
      // File not found at this candidate, or unreadable — try the next one.
    }
  }
  if (!warnedMissing) {
    // One-shot, not per-request. The recommender always falls back to the
    // heuristic, so a missing file is the expected production state.
    warnedMissing = true;
  }
  return null;
}