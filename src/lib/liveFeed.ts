import { prisma } from "@/lib/prisma";

export type ListingActivityEntry = {
  id: string;
  listingId: string;
  listingName: string;
  source: "admin" | "scraper" | "corporate" | "seed";
  actorLabel: string;
  changeSummary: string;
  createdAt: Date;
};

export type GlobalListingActivityEntry = ListingActivityEntry & { providerName: string };

/**
 * Recent activity across a provider's own listings — the "live feed" /
 * "real-time monitor" reinterpreted onto ListingUpdateLog (the only
 * per-listing activity trail that exists) instead of a bank transaction
 * feed. The page polls this via router.refresh() on an interval rather than
 * a push channel — see LiveFeedRefresher.tsx.
 */
export async function getRecentListingActivity(providerId: string, limit = 30): Promise<ListingActivityEntry[]> {
  const rows = await prisma.listingUpdateLog.findMany({
    where: { listing: { providerId } },
    include: { listing: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    listingId: row.listingId,
    listingName: row.listing.name,
    source: row.source,
    actorLabel: row.actorLabel,
    changeSummary: row.changeSummary,
    createdAt: row.createdAt,
  }));
}

/**
 * Admin's counterpart to getRecentListingActivity — same ListingUpdateLog
 * trail, but across every provider rather than one, since "what just
 * changed platform-wide" is what admin needs (the audit log is the closest
 * existing thing, but it's admin-authored actions only, not every listing
 * update from every source).
 */
export async function getRecentListingActivityGlobal(limit = 50): Promise<GlobalListingActivityEntry[]> {
  const rows = await prisma.listingUpdateLog.findMany({
    include: { listing: { select: { name: true, provider: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    listingId: row.listingId,
    listingName: row.listing.name,
    providerName: row.listing.provider.name,
    source: row.source,
    actorLabel: row.actorLabel,
    changeSummary: row.changeSummary,
    createdAt: row.createdAt,
  }));
}
