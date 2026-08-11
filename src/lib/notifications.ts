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

  // Run the upserts concurrently — a sequential loop here is a round-trip to
  // the (remote) DB per saved listing, which is what made the old per-page
  // notifications sync take seconds.
  await Promise.all(
    listingIds.map(async (listingId) => {
      const trend = trends[listingId];
      if (!trend || trend.direction !== "down") return;

      const prior = existingByListing.get(listingId);
      if (prior && prior.changePercent === trend.changePercent) return;

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
    }),
  );
}

/**
 * Tells a provider their submitted listing was approved or rejected, via the
 * same Notification row the price-drop feature uses (so /notifications and
 * its unread badge work for either). Re-approving/re-rejecting the same
 * listing upserts the existing row rather than piling up duplicates, mirroring
 * the price-drop upsert above.
 */
export async function notifyListingDecision(params: {
  listingId: string;
  ownerUserId: string;
  listingName: string;
  status: "published" | "rejected";
  rejectionReason?: string | null;
}): Promise<void> {
  const { listingId, ownerUserId, listingName, status, rejectionReason } = params;
  const type = status === "published" ? "listing_approved" : "listing_rejected";
  const message =
    status === "published"
      ? `"${listingName}" was approved and is now live.`
      : `"${listingName}" was rejected${rejectionReason ? `: ${rejectionReason}` : "."}`;

  await prisma.notification.upsert({
    where: { userId_listingId_type: { userId: ownerUserId, listingId, type } },
    update: { message, read: false },
    create: { userId: ownerUserId, listingId, type, message },
  });
}
