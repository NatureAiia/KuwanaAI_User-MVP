import { z } from "zod";
import { Prisma } from "@prisma/client";
import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { recordPriceChange } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(500).optional() }),
]);

type ProposedData = {
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  attributes: Record<string, unknown>;
  images?: string[];
};

/** Approve or reject a corporate account's pending edit/new-listing request. Never called on anything but a still-pending one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.corporateRequest.findUnique({ where: { id }, include: { provider: true } });
  if (!request) return privateJson({ error: "Not found" }, { status: 404 });
  if (request.status !== "pending") return privateJson({ error: "Already reviewed" }, { status: 409 });

  if (parsed.data.action === "reject") {
    await prisma.corporateRequest.update({
      where: { id },
      data: {
        status: "rejected",
        rejectionReason: parsed.data.reason ?? null,
        reviewedByEmail: admin.email,
        reviewedAt: new Date(),
      },
    });
    await logAdminAction({
      adminEmail: admin.email,
      action: "corporate_request_rejected",
      targetType: "corporate_request",
      targetId: id,
      detail: `Rejected ${request.type} request from "${request.provider.name}"${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`,
    });
    return privateJson({ ok: true });
  }

  const proposed = request.proposedData as ProposedData;
  let listingId: string;

  if (request.type === "edit") {
    if (!request.listingId) return privateJson({ error: "Request has no listing to edit" }, { status: 400 });
    const previous = await prisma.listing.findUnique({ where: { id: request.listingId }, select: { price: true } });
    const listing = await prisma.listing.update({
      where: { id: request.listingId },
      data: {
        name: proposed.name,
        description: proposed.description ?? null,
        price: proposed.price,
        currency: proposed.currency,
        attributes: proposed.attributes as Prisma.InputJsonValue,
        images: proposed.images ?? [],
        lastVerifiedAt: new Date(),
        freshnessStatus: "fresh",
      },
    });
    if (previous && Number(previous.price) !== proposed.price) {
      await recordPriceChange(listing.id, Number(previous.price));
    }
    listingId = listing.id;
  } else {
    if (!request.categoryId) return privateJson({ error: "Request has no category" }, { status: 400 });
    // The corporate request itself was the review step — no second
    // pending_review hop, unlike a never-before-seen scraper candidate.
    const listing = await prisma.listing.create({
      data: {
        categoryId: request.categoryId,
        providerId: request.providerId,
        name: proposed.name,
        description: proposed.description ?? null,
        price: proposed.price,
        currency: proposed.currency,
        attributes: proposed.attributes as Prisma.InputJsonValue,
        images: proposed.images ?? [],
        status: "published",
      },
    });
    listingId = listing.id;
  }

  await prisma.corporateRequest.update({
    where: { id },
    data: { status: "approved", reviewedByEmail: admin.email, reviewedAt: new Date() },
  });
  await logAdminAction({
    adminEmail: admin.email,
    action: "corporate_request_approved",
    targetType: "corporate_request",
    targetId: id,
    detail: `Approved ${request.type} request from "${request.provider.name}" into listing "${proposed.name}"`,
  });

  revalidateCatalog();
  return privateJson({ ok: true, listingId });
}
