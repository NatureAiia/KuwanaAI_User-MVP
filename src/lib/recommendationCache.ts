import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CachedRecommendation = {
  recommended_listing_name: string;
  explanation: string;
  confidence: number;
};

// The recommendation is a pure function of the listing set (no user
// footprint factored in) — this is deliberately not per-user, so any user
// comparing the same listings benefits from an earlier user's cache entry.
const TTL_MS = 60 * 60 * 1000;

/** Order-independent — comparing [A,B] and [B,A] must hit the same cache entry. */
export function recommendationCacheKey(listingIds: string[]): string {
  return [...listingIds].sort().join(",");
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
