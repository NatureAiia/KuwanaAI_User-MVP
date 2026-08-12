import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CachedRecommendation = {
  primary_option: { listing_name: string; key_differentiator: string };
  alternative_options: { listing_name: string; key_differentiator: string }[];
  explanation: { summary: string; key_tradeoffs: string[]; data_traceability_notes: string };
  suggested_action: string;
  confidence: number;
};

/**
 * Guard against stale cache rows written by an older version of the
 * recommendation schema — the key format for a no-context request is
 * identical across versions, so an old-shape row would otherwise be served
 * and crash the route on a missing `primary_option`.
 */
export function isValidRecommendation(payload: unknown): payload is CachedRecommendation {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  const primary = p.primary_option as Record<string, unknown> | null;
  const explanation = p.explanation as Record<string, unknown> | null;
  return (
    typeof primary?.listing_name === "string" &&
    typeof primary.key_differentiator === "string" &&
    Array.isArray(p.alternative_options) &&
    typeof explanation?.summary === "string" &&
    Array.isArray(explanation.key_tradeoffs) &&
    typeof explanation.data_traceability_notes === "string" &&
    typeof p.suggested_action === "string" &&
    typeof p.confidence === "number"
  );
}

// The recommendation is a pure function of the listing set (no user
// footprint factored in) — this is deliberately not per-user, so any user
// comparing the same listings benefits from an earlier user's cache entry.
const TTL_MS = 60 * 60 * 1000;

/**
 * Order-independent — comparing [A,B] and [B,A] must hit the same cache
 * entry. An optional context string (the user's budget flexibility +
 * constraints, normalized) is folded into the key so two users comparing the
 * same listings under *different* needs don't serve each other a stale
 * answer.
 */
export function recommendationCacheKey(listingIds: string[], context = ""): string {
  const base = [...listingIds].sort().join(",");
  return context ? `${base}::${context}` : base;
}

export async function getCachedRecommendation(cacheKey: string): Promise<CachedRecommendation | null> {
  const row = await prisma.recommendationCache.findUnique({ where: { cacheKey } });
  if (!row || row.expiresAt < new Date()) return null;
  return row.payload as CachedRecommendation;
}

export async function setCachedRecommendation(cacheKey: string, payload: CachedRecommendation): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await prisma.recommendationCache.upsert({
    where: { cacheKey },
    update: { payload: payload as unknown as Prisma.InputJsonValue, expiresAt },
    create: { cacheKey, payload: payload as unknown as Prisma.InputJsonValue, expiresAt },
  });
}
