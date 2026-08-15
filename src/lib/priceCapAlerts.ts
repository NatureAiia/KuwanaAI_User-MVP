import type { PriceCapRule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isNotificationEnabled } from "@/lib/notificationPreferences";

export type CapBreachingListing = {
  listingId: string;
  listingName: string;
  providerName: string;
  price: number;
};

export type PriceCapRuleWithBreaches = PriceCapRule & {
  categoryName: string;
  sectorName: string;
  breaches: CapBreachingListing[];
};

/**
 * Every gazetted price-cap rule with its currently-breaching published
 * listings — evaluated on read (no cron), same "compute on view" approach as
 * getAlertRulesWithStatus. Only compares a listing against a rule sharing
 * its exact currency; a cap never gets converted across currencies.
 */
export async function getPriceCapRulesWithBreaches(sectorSlug?: string): Promise<PriceCapRuleWithBreaches[]> {
  const rules = await prisma.priceCapRule.findMany({
    where: sectorSlug ? { category: { sector: { slug: sectorSlug } } } : undefined,
    include: { category: { include: { sector: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (rules.length === 0) return [];

  return Promise.all(
    rules.map(async (rule) => {
      const listings = await prisma.listing.findMany({
        where: {
          categoryId: rule.categoryId,
          status: "published",
          currency: rule.currency,
          price: { gt: rule.capValue },
        },
        include: { provider: { select: { name: true } } },
      });

      return {
        ...rule,
        categoryName: rule.category.name,
        sectorName: rule.category.sector.name,
        breaches: listings.map((l) => ({
          listingId: l.id,
          listingName: l.name,
          providerName: l.provider.name,
          price: Number(l.price),
        })),
      };
    }),
  );
}

/**
 * Upserts a Notification for each rule with at least one breaching listing —
 * exact same "compute + upsert on read" shape as syncAlertRuleNotifications,
 * one summary notification per rule rather than one per breaching listing
 * (a cap can be breached by several listings at once; the notification just
 * says how many).
 */
export async function syncPriceCapNotifications(rules: PriceCapRuleWithBreaches[]): Promise<void> {
  await Promise.all(
    rules
      .filter((rule) => rule.enabled && rule.breaches.length > 0)
      .map(async (rule) => {
        if (!(await isNotificationEnabled(rule.createdByUserId, "price_cap_breached"))) return;

        const message = `${rule.breaches.length} listing(s) in ${rule.categoryName} are priced above the ${rule.currency} ${Number(
          rule.capValue,
        )} cap.`;

        await prisma.notification.upsert({
          where: { userId_priceCapRuleId_type: { userId: rule.createdByUserId, priceCapRuleId: rule.id, type: "price_cap_breached" } },
          update: { message, read: false },
          create: { userId: rule.createdByUserId, priceCapRuleId: rule.id, type: "price_cap_breached", message },
        });
      }),
  );
}
