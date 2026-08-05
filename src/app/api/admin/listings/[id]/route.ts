import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyListingDecision } from "@/lib/notifications";
import { logAdminAction } from "@/lib/adminAudit";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  price: z.number().positive().optional(),
  currency: z.string().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  freshnessStatus: z.enum(["fresh", "stale", "unverified"]).optional(),
  // The provider review queue: approve (-> published) or reject (with a
  // reason the provider sees on /provider) a pending_review submission.
  // Also usable by an admin to directly retire/unpublish any listing.
  status: z.enum(["draft", "pending_review", "published", "rejected"]).optional(),
  rejectionReason: z.string().nullable().optional(),
  // Editing any field is itself an act of verification — bump the clock
  // unless the admin explicitly wants to backdate it for some reason.
  markVerifiedNow: z.boolean().default(true),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { attributes, markVerifiedNow, ...rest } = parsed.data;

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      // Approving clears any stale rejection reason from a prior round.
      ...(rest.status === "published" ? { rejectionReason: null } : {}),
      ...(markVerifiedNow ? { lastVerifiedAt: new Date(), freshnessStatus: rest.freshnessStatus ?? "fresh" } : {}),
    },
    include: { provider: { select: { ownerUserId: true } } },
  });

  // Tell the provider only on an actual approve/reject action from the
  // review queue, not on an incidental admin edit that happens to touch
  // other fields — and only if it's a self-managed provider (ownerUserId set).
  if (rest.status === "published" || rest.status === "rejected") {
    if (listing.provider.ownerUserId) {
      await notifyListingDecision({
        listingId: listing.id,
        ownerUserId: listing.provider.ownerUserId,
        listingName: listing.name,
        status: rest.status,
        rejectionReason: listing.rejectionReason,
      });
    }
    await logAdminAction({
      adminEmail: admin.email!,
      action: rest.status === "published" ? "listing_approved" : "listing_rejected",
      targetType: "listing",
      targetId: listing.id,
      detail:
        rest.status === "published"
          ? `Approved "${listing.name}"`
          : `Rejected "${listing.name}"${listing.rejectionReason ? `: ${listing.rejectionReason}` : ""}`,
    });
  }

  return NextResponse.json({ listing });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const listing = await prisma.listing.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email!,
    action: "listing_deleted",
    targetType: "listing",
    targetId: id,
    detail: `Deleted "${listing.name}"`,
  });

  return NextResponse.json({ ok: true });
}
