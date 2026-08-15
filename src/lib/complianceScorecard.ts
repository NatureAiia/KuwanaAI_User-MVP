import { prisma } from "@/lib/prisma";

export type ProviderScorecard = {
  providerId: string;
  providerName: string;
  verified: boolean;
  publishedListingCount: number;
  rejectedListingCount: number;
  openCases: number;
  inProgressCases: number;
  resolvedCases: number;
  dismissedCases: number;
  /** null when the provider has no closed case yet — never shown as 0, which would read as "instant". */
  avgResolutionDays: number | null;
  warningCount: number;
  fineCount: number;
  suspensionCount: number;
};

/**
 * One row per provider, rolling up signals that already exist elsewhere
 * (Listing.status counts, ListingInvestigation history, Provider.verified)
 * into a single ranked compliance view — aggregation only, nothing new is
 * tracked here. Pass sectorSlug to scope both the listing and case counts to
 * a single sector's worth of a provider's catalog.
 */
export async function getProviderScorecards(sectorSlug?: string): Promise<ProviderScorecard[]> {
  const categoryFilter = { sector: { status: "live" as const, ...(sectorSlug ? { slug: sectorSlug } : {}) } };

  const [listings, investigations] = await Promise.all([
    prisma.listing.findMany({
      where: { category: categoryFilter },
      select: { providerId: true, status: true, provider: { select: { name: true, verified: true } } },
    }),
    prisma.listingInvestigation.findMany({
      where: { listing: { category: categoryFilter } },
      select: { providerId: true, status: true, outcome: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  const byProvider = new Map<string, ProviderScorecard>();
  function ensure(providerId: string, providerName: string, verified: boolean): ProviderScorecard {
    let entry = byProvider.get(providerId);
    if (!entry) {
      entry = {
        providerId,
        providerName,
        verified,
        publishedListingCount: 0,
        rejectedListingCount: 0,
        openCases: 0,
        inProgressCases: 0,
        resolvedCases: 0,
        dismissedCases: 0,
        avgResolutionDays: null,
        warningCount: 0,
        fineCount: 0,
        suspensionCount: 0,
      };
      byProvider.set(providerId, entry);
    }
    return entry;
  }

  for (const listing of listings) {
    const entry = ensure(listing.providerId, listing.provider.name, listing.provider.verified);
    if (listing.status === "published") entry.publishedListingCount += 1;
    if (listing.status === "rejected") entry.rejectedListingCount += 1;
  }

  const resolutionDaysByProvider = new Map<string, number[]>();
  for (const inv of investigations) {
    // A provider can only appear here if it also appeared in the listings
    // query above (same category/sector filter, and an investigation's
    // listing can't outlive its provider's deletion — cascades together).
    const entry = byProvider.get(inv.providerId);
    if (!entry) continue;

    if (inv.status === "open") entry.openCases += 1;
    if (inv.status === "in_progress") entry.inProgressCases += 1;
    if (inv.status === "resolved") entry.resolvedCases += 1;
    if (inv.status === "dismissed") entry.dismissedCases += 1;
    if (inv.outcome === "warning") entry.warningCount += 1;
    if (inv.outcome === "fine") entry.fineCount += 1;
    if (inv.outcome === "suspension") entry.suspensionCount += 1;

    if (inv.resolvedAt) {
      const days = (inv.resolvedAt.getTime() - inv.createdAt.getTime()) / 86_400_000;
      const arr = resolutionDaysByProvider.get(inv.providerId) ?? [];
      arr.push(days);
      resolutionDaysByProvider.set(inv.providerId, arr);
    }
  }

  for (const [providerId, days] of resolutionDaysByProvider) {
    const entry = byProvider.get(providerId);
    if (entry) entry.avgResolutionDays = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
  }

  // Providers with the most active cases first, then the most rejected
  // listings — the two signals worth a regulator's attention first.
  return [...byProvider.values()].sort(
    (a, b) => b.openCases + b.inProgressCases - (a.openCases + a.inProgressCases) || b.rejectedListingCount - a.rejectedListingCount,
  );
}
