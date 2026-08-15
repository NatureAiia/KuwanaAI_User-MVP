import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyListingDecision } from "@/lib/notifications";
import { logAdminAction } from "@/lib/adminAudit";
import { recordPriceChange, logListingUpdate } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";
import { boundedJsonRecord } from "@/lib/zodShared";
import { recordEvent } from "@/lib/gamification/process-event";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  attributes: boundedJsonRecord(50, 16_000).optional(),
  price: z.number().positive().max(100_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
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

  // Capture the pre-edit price before it's overwritten below — needed to
  // snapshot into ListingPriceHistory, which every price-trend/sparkline/
  // price-drop-notification feature reads from.
  const previous = rest.price !== undefined ? await prisma.listing.findUnique({ where: { id }, select: { price: true } }) : null;

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      // Approving clears any stale rejection reason from a prior round.
      ...(rest.status === "published" ? { rejectionReason: null } : {}),
      ...(markVerifiedNow
        ? { lastVerifiedAt: new Date(), freshnessStatus: rest.freshnessStatus ?? "fresh", lastUpdateSource: "admin" }
        : {}),
    },
    include: { provider: { select: { ownerUserId: true } } },
  });

  if (previous && rest.price !== undefined && Number(previous.price) !== rest.price) {
    await recordPriceChange(id, Number(previous.price));
  }

  // markVerifiedNow is the existing "this edit counts as verification" flag
  // — reused here rather than a new condition, so the provenance trail lines
  // up exactly with what already bumps lastVerifiedAt/freshnessStatus above.
  if (markVerifiedNow) {
    const changedFields = Object.keys(rest).filter((k) => k !== "status" && k !== "rejectionReason");
    await logListingUpdate({
      listingId: listing.id,
      source: "admin",
      actorLabel: admin.email,
      changeSummary: changedFields.length > 0 ? `Updated ${changedFields.join(", ")}` : `Edited "${listing.name}"`,
    });
  }

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
      // Only self-managed providers (a real linked account, not one of the
      // seeded reference providers) earn XP for their own approval.
      if (rest.status === "published") {
        await recordEvent(prisma, { userId: listing.provider.ownerUserId, eventType: "listing_approved" });
      }
    }
    await logAdminAction({
      adminEmail: admin.email,
      action: rest.status === "published" ? "listing_approved" : "listing_rejected",
      targetType: "listing",
      targetId: listing.id,
      detail:
        rest.status === "published"
          ? `Approved "${listing.name}"`
          : `Rejected "${listing.name}"${listing.rejectionReason ? `: ${listing.rejectionReason}` : ""}`,
    });
  }

  // The catalog read cache is tag-keyed, not TTL-only — without this an
  // edited or deleted listing keeps serving stale until the backstop expires.
  revalidateCatalog();
  return NextResponse.json({ listing });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const listing = await prisma.listing.delete({ where: { id } });

  await logAdminAction({
    adminEmail: admin.email,
    action: "listing_deleted",
    targetType: "listing",
    targetId: id,
    detail: `Deleted "${listing.name}"`,
  });

  // The catalog read cache is tag-keyed, not TTL-only — without this an
  // edited or deleted listing keeps serving stale until the backstop expires.
  revalidateCatalog();
  return NextResponse.json({ ok: true });
}
