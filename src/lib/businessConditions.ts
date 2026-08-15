import { prisma } from "@/lib/prisma";
import { isNotificationEnabled } from "@/lib/notificationPreferences";

export type BusinessConditionSummary = {
  id: string;
  title: string;
  category: "regulatory" | "competitor" | "macro";
  riskLevel: "low" | "medium" | "high";
  notes: string | null;
  sectorSlug: string | null;
  createdAt: Date;
};

/**
 * Read-only surfacing for /regulator and /corporate — both just need "what's
 * being tracked right now", ranked by risk. Admin manages the full CRUD at
 * /admin/business-conditions; this never writes.
 */
export async function getActiveBusinessConditions(sectorSlug?: string): Promise<BusinessConditionSummary[]> {
  const conditions = await prisma.businessCondition.findMany({
    where: sectorSlug ? { OR: [{ sectorSlug }, { sectorSlug: null }] } : undefined,
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
    take: 20,
  });
  return conditions;
}

/**
 * Upserts a Notification for each condition assigned to this admin whose
 * review cycle has elapsed since it was last updated — same "compute +
 * upsert on read" shape as syncPriceDropNotifications/
 * syncAlertRuleNotifications, run from admin/layout.tsx on every admin page
 * load rather than a cron (none exists yet anywhere in this app).
 */
export async function syncBusinessConditionReviewNotifications(adminUserId: string): Promise<void> {
  if (!(await isNotificationEnabled(adminUserId, "business_condition_review_due"))) return;

  const conditions = await prisma.businessCondition.findMany({
    where: { assignedToUserId: adminUserId, reviewCycleDays: { not: null } },
  });

  const now = Date.now();
  await Promise.all(
    conditions.map(async (condition) => {
      const dueAt = condition.updatedAt.getTime() + condition.reviewCycleDays! * 24 * 60 * 60 * 1000;
      if (dueAt > now) return;

      const overdueDays = Math.floor((now - dueAt) / (24 * 60 * 60 * 1000));
      const message = `"${condition.title}" is due for review${overdueDays > 0 ? ` (${overdueDays}d overdue)` : ""}.`;

      await prisma.notification.upsert({
        where: {
          userId_businessConditionId_type: {
            userId: adminUserId,
            businessConditionId: condition.id,
            type: "business_condition_review_due",
          },
        },
        update: { message, read: false },
        create: {
          userId: adminUserId,
          businessConditionId: condition.id,
          type: "business_condition_review_due",
          message,
        },
      });
    }),
  );
}
