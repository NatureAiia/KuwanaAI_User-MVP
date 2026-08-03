import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";

/**
 * Checks the user's saved listings for a price drop and upserts a
 * Notification per listing. Skipped (no DB write) if the drop hasn't
 * changed since the last check, so re-syncing doesn't spam or re-surface an
 * already-read notification for the same trend.
 */
export async function syncPriceDropNotifications(userId: string): Promise<void> {
  const saved = await prisma.savedListing.findMany({ where: { userId }, select: { listingId: true } });
  if (saved.length === 0) return;

  const listingIds = saved.map((s) => s.listingId);
  const [trends, existing] = await Promise.all([
    getListingPriceTrends(listingIds),
    prisma.notification.findMany({ where: { userId, listingId: { in: listingIds }, type: "price_drop" } }),
  ]);
  const existingByListing = new Map(existing.map((n) => [n.listingId, n]));

  for (const listingId of listingIds) {
    const trend = trends[listingId];
    if (!trend || trend.direction !== "down") continue;

    const prior = existingByListing.get(listingId);
    if (prior && prior.changePercent === trend.changePercent) continue;

    await prisma.notification.upsert({
      where: { userId_listingId_type: { userId, listingId, type: "price_drop" } },
      update: {
        message: `Price dropped ${Math.abs(trend.changePercent)}% over the last ${trend.periodDays} days.`,
        changePercent: trend.changePercent,
        read: false,
      },
      create: {
        userId,
        listingId,
        type: "price_drop",
        message: `Price dropped ${Math.abs(trend.changePercent)}% over the last ${trend.periodDays} days.`,
        changePercent: trend.changePercent,
      },
    });
  }
}
