import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireUser, getUserRole } from "@/lib/auth";
import { emailDomain } from "@/lib/orgVerification";
import { syncPriceDropNotifications } from "@/lib/notifications";
import { getAlertRulesWithStatus, syncAlertRuleNotifications } from "@/lib/alerts";
import { syncBusinessConditionReviewNotifications } from "@/lib/businessConditions";
import { getPriceCapRulesWithBreaches, syncPriceCapNotifications } from "@/lib/priceCapAlerts";

// Price-drop detection reads every saved listing's full price history and
// writes upserts — far too expensive to run on the unread-badge request the
// header fires on every page load. Gate it behind a short per-user cooldown
// so the badge reads stay a single fast query and the sync runs at most once
// per window. Persisted on the User row (not an in-memory Map): this app
// deploys on Vercel (see vercel.json), where a request can land on any warm
// instance, so process-local state isn't reliably shared across requests.
const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

export async function GET() {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  // Each branch is a cheap "compute on read, upsert if changed" pass (see
  // syncPriceDropNotifications, syncAlertRuleNotifications,
  // syncBusinessConditionReviewNotifications). Only the price-drop path
  // needs the cooldown below (it reads full price history per saved
  // listing); the other two are small findMany + upsert passes over a
  // single user's own rows, cheap enough to run on every bell poll.
  const role = await getUserRole(user.id);
  if (role === "consumer" || role === "provider") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastNotificationSyncAt: true },
    });
    const now = Date.now();
    const lastSync = dbUser?.lastNotificationSyncAt?.getTime() ?? 0;
    if (now - lastSync > SYNC_COOLDOWN_MS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastNotificationSyncAt: new Date(now) },
      });
      // No-op for a provider account (they have no SavedListing rows) — cheap
      // enough to call unconditionally rather than branching further.
      await syncPriceDropNotifications(user.id);
    }
  } else if (role === "corporate") {
    const domain = user.email ? emailDomain(user.email) : null;
    const provider = domain ? await prisma.provider.findFirst({ where: { corporateDomain: domain } }) : null;
    if (provider) {
      const rules = await getAlertRulesWithStatus(provider.id);
      await syncAlertRuleNotifications(rules);
    }
  } else if (role === "admin") {
    await syncBusinessConditionReviewNotifications(user.id);
  } else if (role === "regulator") {
    const rules = await getPriceCapRulesWithBreaches();
    await syncPriceCapNotifications(rules);
  }

  // One notification per saved listing/alert rule/business condition per
  // type, so this inherits the same unbounded growth as /api/saved. The bell
  // shows a count and a recent list; nobody scrolls past 100.
  //
  // unreadCount is counted in the database rather than derived from the page
  // above — deriving it would silently under-report the moment a user has
  // more unread notifications than the page size, which is exactly when the
  // badge matters most.
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      include: { listing: { include: { provider: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return privateJson({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt,
      listing: n.listing ? { id: n.listing.id, name: n.listing.name, provider: n.listing.provider.name } : null,
    })),
    unreadCount,
  });
}
