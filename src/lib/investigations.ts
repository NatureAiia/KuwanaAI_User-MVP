import { prisma } from "@/lib/prisma";
import type { InvestigationOutcome } from "@prisma/client";

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

export type RegulatorInvestigationSummary = InvestigationSummary & {
  providerId: string;
  providerName: string;
  sectorName: string;
  outcome: InvestigationOutcome;
  evidenceUrls: string[];
};

/**
 * Every investigation across every provider — the regulator-side case
 * queue. Unlike getInvestigationsForProvider, this isn't scoped to one
 * provider's own listings, since a regulator's job is oversight across the
 * whole market, not self-service tracking of a single business's inventory.
 */
export async function getAllInvestigations(filters?: {
  sectorSlug?: string;
  status?: InvestigationSummary["status"];
}): Promise<RegulatorInvestigationSummary[]> {
  const rows = await prisma.listingInvestigation.findMany({
    where: {
      status: filters?.status,
      listing: filters?.sectorSlug ? { category: { sector: { slug: filters.sectorSlug } } } : undefined,
    },
    include: {
      listing: { select: { name: true, category: { select: { sector: { select: { name: true } } } } } },
      provider: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    listingId: row.listingId,
    listingName: row.listing.name,
    providerId: row.providerId,
    providerName: row.provider.name,
    sectorName: row.listing.category.sector.name,
    reason: row.reason,
    status: row.status,
    notes: row.notes,
    outcome: row.outcome,
    evidenceUrls: row.evidenceUrls,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }));
}

/** Listing ids under active investigation by ANY provider — the regulator-wide counterpart to getActivelyInvestigatedListingIds. */
export async function getActivelyInvestigatedListingIdsGlobal(): Promise<Set<string>> {
  const rows = await prisma.listingInvestigation.findMany({
    where: { status: { in: ["open", "in_progress"] } },
    select: { listingId: true },
  });
  return new Set(rows.map((r) => r.listingId));
}
