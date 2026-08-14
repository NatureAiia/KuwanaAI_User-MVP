import type { DiscountRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Active provider discounts right now — both category- and listing-scoped. */
export async function getActiveDiscountsForProvider(
  providerId: string,
  now: Date = new Date(),
): Promise<DiscountRule[]> {
  return prisma.discountRule.findMany({
    where: { providerId, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { createdAt: "desc" },
  });
}

/** Rounds to 2dp the way every other price in the app is displayed. */
export function computeEffectivePrice(price: number, percentOff: number): number {
  return Math.round(price * (1 - percentOff / 100) * 100) / 100;
}

function mostRecentByKey<T>(rows: T[], keyFn: (row: T) => string | null): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row);
    // Rows arrive ordered by createdAt desc, so the first row seen per key is
    // already the most recent — a later duplicate never overwrites it.
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

/**
 * Resolves the single active discount (if any) that applies to each listing —
 * a listing-scoped rule takes priority over a category-scoped one covering
 * the same listing. Overlay only: this never feeds back into peer price
 * stats or outlier z-scores, it just tells a display layer what discount, if
 * any, currently applies.
 */
export async function getActiveDiscountsMap(
  listings: { id: string; categoryId: string }[],
  now: Date = new Date(),
): Promise<Map<string, DiscountRule>> {
  if (listings.length === 0) return new Map();

  const listingIds = listings.map((l) => l.id);
  const categoryIds = [...new Set(listings.map((l) => l.categoryId))];
  const activeWhere = { startsAt: { lte: now }, endsAt: { gte: now } };

  const [listingRules, categoryRules] = await Promise.all([
    prisma.discountRule.findMany({
      where: { ...activeWhere, scope: "listing", listingId: { in: listingIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.discountRule.findMany({
      where: { ...activeWhere, scope: "category", categoryId: { in: categoryIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const ruleByListingId = mostRecentByKey(listingRules, (r) => r.listingId);
  const ruleByCategoryId = mostRecentByKey(categoryRules, (r) => r.categoryId);

  const result = new Map<string, DiscountRule>();
  for (const listing of listings) {
    const rule = ruleByListingId.get(listing.id) ?? ruleByCategoryId.get(listing.categoryId);
    if (rule) result.set(listing.id, rule);
  }
  return result;
}
