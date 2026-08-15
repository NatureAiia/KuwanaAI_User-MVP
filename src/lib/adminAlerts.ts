import type { AdminAlertRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAlertTriggered } from "@/lib/alerts";

export const ADMIN_METRIC_LABEL: Record<AdminAlertRule["metric"], string> = {
  total_providers: "Total providers",
  published_listings: "Published listings (platform-wide)",
  pending_review_listings: "Listings awaiting review",
  open_investigations: "Open investigations",
  pending_corporate_requests: "Pending corporate requests",
};

/**
 * Admin's counterpart to getProviderMetricValue in lib/alerts.ts — every
 * metric here is a platform-wide count instead of one provider's own
 * listings, since an admin needs "is the whole platform healthy" watchers,
 * not per-provider ones (that's what AlertRule already covers).
 */
export async function getAdminMetricValue(metric: AdminAlertRule["metric"]): Promise<number> {
  switch (metric) {
    case "total_providers":
      return prisma.provider.count();
    case "published_listings":
      return prisma.listing.count({ where: { status: "published" } });
    case "pending_review_listings":
      return prisma.listing.count({ where: { status: "pending_review" } });
    case "open_investigations":
      return prisma.listingInvestigation.count({ where: { status: { in: ["open", "in_progress"] } } });
    case "pending_corporate_requests":
      return prisma.corporateRequest.count({ where: { status: "pending" } });
  }
}

export type AdminAlertRuleWithStatus = AdminAlertRule & { currentValue: number; triggered: boolean };

/** Live-evaluated, not persisted — same "compute on view" approach as AlertRule's getAlertRulesWithStatus. */
export async function getAdminAlertRulesWithStatus(): Promise<AdminAlertRuleWithStatus[]> {
  const rules = await prisma.adminAlertRule.findMany({ orderBy: { createdAt: "desc" } });

  return Promise.all(
    rules.map(async (rule) => {
      const currentValue = await getAdminMetricValue(rule.metric);
      return { ...rule, currentValue, triggered: rule.enabled && isAlertTriggered(rule, currentValue) };
    }),
  );
}
