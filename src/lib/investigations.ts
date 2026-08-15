import { prisma } from "@/lib/prisma";

export type InvestigationSummary = {
  id: string;
  listingId: string;
  listingName: string;
  reason: string;
  status: "open" | "in_progress" | "resolved" | "dismissed";
  notes: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

/** Every investigation a provider has open or has closed out, most recently created first within each status. */
export async function getInvestigationsForProvider(providerId: string): Promise<InvestigationSummary[]> {
  const rows = await prisma.listingInvestigation.findMany({
    where: { providerId },
    include: { listing: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    listingId: row.listingId,
    listingName: row.listing.name,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }));
}

/** Listing ids that already have an open or in-progress investigation — used to avoid offering "Flag" twice on the same listing. */
export async function getActivelyInvestigatedListingIds(providerId: string): Promise<Set<string>> {
  const rows = await prisma.listingInvestigation.findMany({
    where: { providerId, status: { in: ["open", "in_progress"] } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}
