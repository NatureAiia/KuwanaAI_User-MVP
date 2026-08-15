import { prisma } from "@/lib/prisma";

export type ComplaintSummary = {
  id: string;
  submitterEmail: string;
  listingId: string | null;
  listingName: string | null;
  providerName: string | null;
  description: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  linkedInvestigationId: string | null;
  createdAt: Date;
};

/** The regulator-facing complaint queue, most recent first. */
export async function getComplaintQueue(filters?: { status?: ComplaintSummary["status"] }): Promise<ComplaintSummary[]> {
  const rows = await prisma.consumerComplaint.findMany({
    where: { status: filters?.status },
    include: { user: { select: { email: true } }, listing: { select: { name: true, provider: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    submitterEmail: row.user.email,
    listingId: row.listingId,
    listingName: row.listing?.name ?? null,
    providerName: row.listing?.provider.name ?? null,
    description: row.description,
    status: row.status,
    linkedInvestigationId: row.linkedInvestigationId,
    createdAt: row.createdAt,
  }));
}

/**
 * Promotes a complaint into a real enforcement case (see
 * getAllInvestigations in investigations.ts) and links the two — a complaint
 * with no listingId can't be promoted, since ListingInvestigation always
 * needs one.
 */
export async function promoteComplaintToInvestigation(
  complaintId: string,
  assignedToUserId: string,
): Promise<{ error: string } | { investigationId: string }> {
  const complaint = await prisma.consumerComplaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return { error: "Complaint not found" };
  if (!complaint.listingId) return { error: "This complaint isn't tied to a specific listing, so it can't become a case" };

  const listing = await prisma.listing.findUnique({ where: { id: complaint.listingId }, select: { providerId: true } });
  if (!listing) return { error: "Listing no longer exists" };

  const investigation = await prisma.listingInvestigation.create({
    data: {
      listingId: complaint.listingId,
      providerId: listing.providerId,
      reason: `Consumer complaint: ${complaint.description.slice(0, 400)}`,
      assignedToUserId,
    },
  });

  await prisma.consumerComplaint.update({
    where: { id: complaintId },
    data: { linkedInvestigationId: investigation.id, status: "reviewing" },
  });

  return { investigationId: investigation.id };
}
