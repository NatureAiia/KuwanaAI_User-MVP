import { prisma } from "@/lib/prisma";
import { getProviderMetricValue, getAlertRulesWithStatus, METRIC_LABEL } from "@/lib/alerts";
import { getInvestigationsForProvider } from "@/lib/investigations";

const MAX_SAVED_LISTINGS = 10;
const MAX_COMPARISONS = 5;

/**
 * A consumer's own account facts the chat assistant can answer questions
 * about without the client having to pass listing IDs — same "server
 * computes it, model only recites it" grounding shape the listing-specific
 * grounding in api/chat/route.ts already uses. Cheap enough (small
 * queries on one user's own rows) to build on every chat turn rather than
 * detecting intent first.
 */
export async function getConsumerChatContext(userId: string) {
  const [user, saved, unreadNotifications, comparisons] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { walletBalanceUsd: true, walletBalanceZig: true } }),
    prisma.savedListing.findMany({
      where: { userId },
      orderBy: { savedAt: "desc" },
      take: MAX_SAVED_LISTINGS,
      include: { listing: { include: { provider: true } } },
    }),
    prisma.notification.count({ where: { userId, read: false } }),
    prisma.comparison.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_COMPARISONS,
      include: { category: true },
    }),
  ]);

  // Comparisons only store listing ids — a second small query resolves the
  // names/providers actually worth showing the model, rather than a raw id
  // list it cannot say anything useful about.
  const comparisonListingIds = [...new Set(comparisons.flatMap((c) => c.listingIds))];
  const comparisonListings =
    comparisonListingIds.length > 0
      ? await prisma.listing.findMany({
          where: { id: { in: comparisonListingIds } },
          include: { provider: true },
        })
      : [];
  const listingById = new Map(comparisonListings.map((l) => [l.id, l]));

  return {
    wallet_balance_usd: user ? Number(user.walletBalanceUsd) : 0,
    wallet_balance_zig: user ? Number(user.walletBalanceZig) : 0,
    unread_notifications: unreadNotifications,
    saved_listings: saved.map((s) => ({
      id: s.listing.id,
      name: s.listing.name,
      price: Number(s.listing.price),
      currency: s.listing.currency,
      provider: s.listing.provider.name,
    })),
    // Most recent first — lets the assistant open with "you were comparing
    // X and Y" without the client ever having to pass comparison ids in.
    past_comparisons: comparisons.map((c) => ({
      category: c.category.name,
      compared_at: c.createdAt.toISOString(),
      listings: c.listingIds
        .map((id) => listingById.get(id))
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => ({ name: l.name, provider: l.provider.name, price: Number(l.price), currency: l.currency })),
    })),
  };
}

/**
 * A corporate user's own provider facts — published listing count/average
 * price, currently-triggered alert rules, and open investigations. Same
 * "compute on read" shape as getAlertRulesWithStatus/getInvestigationsForProvider,
 * just packaged for the system prompt instead of a page.
 */
export async function getCorporateChatContext(providerId: string) {
  const [listingCount, avgPrice, investigations, alertRules] = await Promise.all([
    getProviderMetricValue(providerId, "listing_count"),
    getProviderMetricValue(providerId, "avg_price"),
    getInvestigationsForProvider(providerId),
    getAlertRulesWithStatus(providerId),
  ]);

  const openInvestigations = investigations.filter((i) => i.status === "open" || i.status === "in_progress");

  return {
    published_listing_count: listingCount,
    average_listing_price: Math.round(avgPrice * 100) / 100,
    open_investigations: openInvestigations.map((i) => ({
      listing: i.listingName,
      reason: i.reason,
      status: i.status,
    })),
    triggered_alerts: alertRules
      .filter((r) => r.triggered)
      .map((r) => `${METRIC_LABEL[r.metric]} ${r.direction === "above" ? "rose above" : "fell below"} ${Number(r.threshold)} (currently ${r.currentValue.toFixed(2)})`),
  };
}
