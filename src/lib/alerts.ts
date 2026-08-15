import type { AlertRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import { isNotificationEnabled } from "@/lib/notificationPreferences";

export const METRIC_LABEL: Record<AlertRule["metric"], string> = {
  avg_price: "Average listing price",
  listing_count: "Published listing count",
  trending_down: "Listings trending down",
  trending_up: "Listings trending up",
  unverified_count: "Unverified listings",
};

/**
 * Every metric here is scoped to the provider's OWN published listings —
 * not a sector-wide rollup. A corporate account already watches sector
 * trends on Market Intelligence; what it can't see anywhere else is "how is
 * MY inventory doing right now", which is what an alert rule threshold-tests.
 * `unverified_count` (in the AlertMetric enum for future admin-side use) has
 * no self-scoped meaning for an already-linked corporate account, so it's
 * left out of getProviderMetricValue and the corporate-facing rule form.
 */
export async function getProviderMetricValue(
  providerId: string,
  metric: "avg_price" | "listing_count" | "trending_down" | "trending_up",
): Promise<number> {
  const listings = await prisma.listing.findMany({
    where: { providerId, status: "published" },
    select: { id: true, price: true },
  });

  if (metric === "listing_count") return listings.length;
  if (metric === "avg_price") {
    if (listings.length === 0) return 0;
    return listings.reduce((sum, l) => sum + Number(l.price), 0) / listings.length;
  }

  // trending_down / trending_up
  const trendsByListingId = await getListingPriceTrends(listings.map((l) => l.id));
  const direction = metric === "trending_down" ? "down" : "up";
  return Object.values(trendsByListingId).filter((t) => t?.direction === direction).length;
}

export function isAlertTriggered(rule: Pick<AlertRule, "direction" | "threshold">, currentValue: number): boolean {
  const threshold = Number(rule.threshold);
  return rule.direction === "above" ? currentValue > threshold : currentValue < threshold;
}

export type AlertRuleWithStatus = AlertRule & { currentValue: number; triggered: boolean };

/** Live-evaluated, not persisted — same "compute on view" approach as syncPriceDropNotifications. */
export async function getAlertRulesWithStatus(providerId: string): Promise<AlertRuleWithStatus[]> {
  const rules = await prisma.alertRule.findMany({ where: { providerId }, orderBy: { createdAt: "desc" } });

  return Promise.all(
    rules.map(async (rule) => {
      if (rule.metric === "unverified_count") {
        return { ...rule, currentValue: 0, triggered: false };
      }
      const currentValue = await getProviderMetricValue(providerId, rule.metric);
      return { ...rule, currentValue, triggered: rule.enabled && isAlertTriggered(rule, currentValue) };
    }),
  );
}

/**
 * Upserts a Notification for each currently-triggered rule, so the corporate
 * bell surfaces a crossed threshold without the user having to open
 * /corporate/alerts. Same "compute + upsert on read" shape as
 * syncPriceDropNotifications — no cron exists yet to drive this any other
 * way, and (matching that function) an untriggered rule just stops being
 * upserted rather than deleting a previously-surfaced notification.
 */
export async function syncAlertRuleNotifications(rules: AlertRuleWithStatus[]): Promise<void> {
  await Promise.all(
    rules
      .filter((rule) => rule.triggered)
      .map(async (rule) => {
        if (!(await isNotificationEnabled(rule.createdByUserId, "alert_threshold_crossed"))) return;

        const message = `${METRIC_LABEL[rule.metric]} is ${rule.direction === "above" ? "above" : "below"} ${Number(
          rule.threshold,
        )} (currently ${rule.currentValue.toFixed(2)}).`;

        await prisma.notification.upsert({
          where: { userId_alertRuleId_type: { userId: rule.createdByUserId, alertRuleId: rule.id, type: "alert_threshold_crossed" } },
          update: { message, read: false },
          create: { userId: rule.createdByUserId, alertRuleId: rule.id, type: "alert_threshold_crossed", message },
        });
      }),
  );
}
