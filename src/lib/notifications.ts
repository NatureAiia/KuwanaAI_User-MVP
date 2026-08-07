import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";

/**
 * How long a user's notification sync result is considered current.
 *
 * This runs on every GET /api/notifications — a read path doing a fan-out
 * read plus N upserts. The notification bell polls it, so opening a few
 * pages in a row previously re-ran the whole thing each time for data that
 * only changes when the price-history cron writes a new row (daily).
 */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Last sync time per user, in this process's memory. Deliberately not a DB
 * column: being wrong here costs one redundant sync (which is idempotent),
 * not a correctness bug, and it isn't worth a migration plus a write on
 * every read to track. On a multi-instance deploy each instance syncs at
 * most once per interval, which is still a large reduction on the previous
 * every-single-request behaviour.
 */
const lastSyncedAt = new Map<string, number>();

/**
 * Checks the user's saved listings for a price drop and upserts a
 * Notification per listing. Skipped (no DB write) if the drop hasn't
 * changed since the last check, so re-syncing doesn't spam or re-surface an
 * already-read notification for the same trend.
 *
 * Pass `force` to bypass the interval throttle (a test, or a path that just
 * changed the user's saved listings and wants the bell correct immediately).
 */
export async function syncPriceDropNotifications(userId: string, force = false): Promise<void> {
  const now = Date.now();
  const last = lastSyncedAt.get(userId);
  if (!force && last !== undefined && now - last < SYNC_INTERVAL_MS) return;
  lastSyncedAt.set(userId, now);

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
