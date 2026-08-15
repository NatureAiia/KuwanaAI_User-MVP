/**
 * Tiered model routing.
 *
 * Each feature has a ladder of models ordered cheapest-first. Two things move
 * a call up it:
 *
 *   1. Complexity, judged before the call from cheap signals we already have
 *      (how many listings are being compared, how long the query is, whether
 *      an image is attached). This picks the *starting* rung, so easy work
 *      never touches an expensive model at all.
 *   2. Failure, after the call. A rung that errors, times out, or returns
 *      unparseable output hands off to the next one up.
 *
 * The two are deliberately different mechanisms. Complexity is a guess made
 * with no evidence, so it must be cheap and conservative; failure is hard
 * evidence, so it escalates unconditionally. Judging complexity by asking a
 * model would defeat the point — the classification call would cost about what
 * it saves.
 */

import { findModel, type AiFeature, type ModelSpec } from "./models";

/**
 * Ladders are ordered cheap → capable. A single-entry ladder is valid and
 * means "never escalate", which is the right setting for a feature where a
 * wrong-but-fast answer is worse than a slow one.
 */
export const DEFAULT_TIERS: Record<AiFeature, string[]> = {
  // Chat streams to a waiting user and can carry an image, so the starting
  // rung must be vision-capable — the self-hosted model is both that and
  // free, so it leads. The OpenRouter free tier is next in case Ollama is
  // unreachable, then paid Claude for anything that needs real capability.
  chat: ["llama-3.2-vision", "nvidia/nemotron-3-super-120b-a12b:free", "claude-haiku-4-5", "claude-opus-5"],
  recommendations: [
    "llama-3.2-vision",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "claude-haiku-4-5",
    "claude-sonnet-5",
  ],
  // Intake is a closed-list classifier — the cheapest rung handles nearly all
  // of it, and a wrong answer degrades to "no confident match" rather than
  // showing a user something false.
  intake: ["llama-3.2-vision", "nvidia/nemotron-3-super-120b-a12b:free", "claude-haiku-4-5"],
  // Every extraction lands in an admin review queue before it touches a
  // listing, so a wrong answer costs a reviewer a click rather than showing a
  // user something false — the cheap rung is the right default here too.
  scrape_extract: ["llama-3.2-vision", "nvidia/nemotron-3-super-120b-a12b:free", "claude-haiku-4-5"],
  // A narrative explaining outliers the heuristic already found — never the
  // decision itself, so a weak-but-free rung is the right default; escalation
  // only kicks in if that rung actually fails to produce usable prose.
  pricing_intelligence_narrative: ["llama-3.2-vision", "nvidia/nemotron-3-super-120b-a12b:free", "claude-haiku-4-5"],
  // A closed 3-way classification of a short social post — the cheapest rung
  // handles this the same way it handles `intake`, and a wrong label costs
  // nothing worse than a mis-colored badge in an admin triage queue.
  sentiment_analysis: ["llama-3.2-vision", "nvidia/nemotron-3-super-120b-a12b:free", "claude-haiku-4-5"],
};

/** Signals available at each call site without extra work or extra calls. */
export type ComplexitySignals =
  | { feature: "intake"; query: string }
  | {
      feature: "recommendations";
      listingCount: number;
      comparableAttributes: number;
      hasPriceTrends: boolean;
    }
  | {
      feature: "chat";
      hasImage: boolean;
      turnCount: number;
      messageLength: number;
      groundedListings: number;
    }
  | { feature: "scrape_extract"; contentLength: number; attributeCount: number }
  | { feature: "pricing_intelligence_narrative"; outlierCount: number; listingCount: number }
  | { feature: "sentiment_analysis"; batchSize: number };

/** Clamps to 0..1 so every scorer below can add freely without overshooting. */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 0 = trivially easy, 1 = send it to the best model available.
 *
 * The weights are judgement, not measurement — they encode "what makes this
 * particular task harder", and each one is a thing that genuinely costs the
 * model reasoning rather than just tokens.
 */
export function scoreComplexity(signals: ComplexitySignals): number {
  switch (signals.feature) {
    case "intake": {
      const words = signals.query.trim().split(/\s+/).filter(Boolean).length;
      // A three-word need ("cheap data bundle") is a lookup. A long one is
      // usually a person describing a situation, which takes interpreting.
      const length = clamp01((words - 4) / 26);
      // Conjunctions and questions signal a need with more than one clause,
      // which is where the cheap model starts picking only the first one.
      const clauses = /\b(and|or|but|also|plus|as well as)\b/i.test(signals.query) ? 0.2 : 0;
      const question = /\?/.test(signals.query) ? 0.1 : 0;
      return clamp01(length * 0.7 + clauses + question);
    }

    case "recommendations": {
      // Comparing 2 listings is a pairwise call; comparing 6 across many
      // attributes is the case where cheap models start ignoring dimensions.
      const breadth = clamp01((signals.listingCount - 2) / 4);
      const depth = clamp01((signals.comparableAttributes - 3) / 9);
      // A trend adds a second axis (is it getting cheaper?) on top of price.
      const trends = signals.hasPriceTrends ? 0.15 : 0;
      return clamp01(breadth * 0.45 + depth * 0.4 + trends);
    }

    case "chat": {
      // An image is handled by capability filtering, not by score — but it
      // also genuinely makes the turn harder, so it counts here too.
      const image = signals.hasImage ? 0.45 : 0;
      // Long threads need the model to hold earlier context straight.
      const depth = clamp01((signals.turnCount - 4) / 16) * 0.25;
      const length = clamp01((signals.messageLength - 120) / 900) * 0.2;
      // Grounding data must be reasoned over rather than recited.
      const grounding = clamp01(signals.groundedListings / 4) * 0.2;
      return clamp01(image + depth + length + grounding);
    }

    case "scrape_extract": {
      // A long page (a full tariff table) takes more reasoning to pick the
      // right numbers out of than a short one, and more target fields means
      // more chances to drop or mis-map one.
      const length = clamp01((signals.contentLength - 2000) / 8000);
      const breadth = clamp01((signals.attributeCount - 3) / 12);
      return clamp01(length * 0.6 + breadth * 0.4);
    }

    case "pricing_intelligence_narrative": {
      // A sector with more outliers to explain, or a bigger catalog to
      // contextualize them against, takes more reasoning to summarize
      // coherently than a quiet sector with a handful of listings.
      const outliers = clamp01(signals.outlierCount / 10);
      const scale = clamp01((signals.listingCount - 10) / 90);
      return clamp01(outliers * 0.7 + scale * 0.3);
    }

    case "sentiment_analysis": {
      // A bigger batch means more posts for a weak model to lose track of
      // partway through — same shape as recommendations' breadth term.
      return clamp01((signals.batchSize - 10) / 40);
    }
  }
}

export type TierPlan = {
  /** The rungs still available, in order, starting at the chosen one. */
  candidates: ModelSpec[];
  /** Index of the starting rung within the full ladder, for reporting. */
  startIndex: number;
  complexity: number;
};

/**
 * Turns a ladder plus a complexity score into the ordered list of models to
 * try. Rungs below the starting one are dropped — escalation only ever moves
 * up, because a rung that was too weak to start on will not rescue a failure.
 */
export function planTiers(params: {
  ladder: string[];
  complexity: number;
  /** Chat with an attachment: rungs that cannot read images are unusable. */
  requireVision?: boolean;
}): TierPlan {
  const resolved = params.ladder.map(findModel).filter((m): m is ModelSpec => m !== undefined);

  // An empty or fully unresolvable ladder would leave nothing to call. Falling
  // through to the strongest model we know is the safe direction to fail.
  if (resolved.length === 0) {
    const fallback = findModel("claude-opus-5");
    return { candidates: fallback ? [fallback] : [], startIndex: 0, complexity: params.complexity };
  }

  const usable = params.requireVision ? resolved.filter((m) => m.vision) : resolved;
  // Every rung is text-only but the caller needs vision: prefer a correct
  // answer over a cheap one and use the best rung, which provider.ts will then
  // describe the image away for.
  if (usable.length === 0) {
    return {
      candidates: [resolved[resolved.length - 1]],
      startIndex: resolved.length - 1,
      complexity: params.complexity,
    };
  }

  // Round rather than floor: with a 2-rung ladder, floor would only ever reach
  // the top rung at a complexity of exactly 1.0.
  const startIndex = Math.round(clamp01(params.complexity) * (usable.length - 1));

  return {
    candidates: usable.slice(startIndex),
    startIndex,
    complexity: params.complexity,
  };
}
