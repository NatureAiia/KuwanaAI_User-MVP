import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import { isNotificationEnabled } from "@/lib/notificationPreferences";
import { adminEmailAllowlist } from "@/lib/auth";

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

  if (!(await isNotificationEnabled(userId, "price_drop"))) return;

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
  if (!(await isNotificationEnabled(ownerUserId, type))) return;

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

/**
 * Tells every admin a corporate/provider/regulator applicant just finished
 * onboarding — called from /api/onboarding right after applicationStatus is
 * set to "pending" for those three roles. "Admin" here means either the real
 * `admin` Role or the ADMIN_EMAILS allowlist fallback (see isAllowlistedAdmin
 * in src/lib/auth.ts) — the same two mechanisms requireAdmin() itself treats
 * as equivalent, so this notifies everyone requireAdmin() would let through.
 *
 * Upserted per (admin, applicant) via applicantUserId — Notification has no
 * scoping column for "one specific other user" among its existing nullable
 * FKs (they're all listing/rule-shaped), so this is a new one, following the
 * same "own nullable column + its own unique constraint" pattern as
 * alertRuleId/businessConditionId/priceCapRuleId. Re-running onboarding for
 * the same applicant (e.g. after a mid-flow retry) updates the same row
 * instead of spamming a duplicate.
 */
export async function notifyAdminNewApplication(params: {
  applicantUserId: string;
  applicantEmail: string;
  role: string;
  username: string;
}): Promise<void> {
  const { applicantUserId, applicantEmail, role, username } = params;
  const type = "user_application_submitted";

  const allowlist = adminEmailAllowlist();
  const admins = await prisma.user.findMany({
    where: {
      OR: [{ role: "admin" }, ...(allowlist.length > 0 ? [{ email: { in: allowlist } }] : [])],
    },
    select: { id: true },
  });
  if (admins.length === 0) return;

  const message = `${username} (${applicantEmail}) applied as ${role} — review pending.`;

  await Promise.all(
    admins.map(async (admin) => {
      if (!(await isNotificationEnabled(admin.id, type))) return;
      await prisma.notification.upsert({
        where: { userId_applicantUserId_type: { userId: admin.id, applicantUserId, type } },
        update: { message, read: false },
        create: { userId: admin.id, applicantUserId, type, message },
      });
    }),
  );
}
