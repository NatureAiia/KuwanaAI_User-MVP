import { z } from "zod";
import { Prisma } from "@prisma/client";
import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { recordPriceChange } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().max(500).optional() }),
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

type ProposedField = {
  key: string;
  label: string;
  consumerLabel?: string | null;
  dataType: "number" | "string" | "enum" | "boolean";
  unit?: string | null;
  qualityAxis?: "value" | "trust" | "availability" | "performance" | "resilience" | null;
};

/** Approve or reject a corporate account's pending edit/new-listing/new-field request. Never called on anything but a still-pending one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const request = await prisma.corporateRequest.findUnique({ where: { id }, include: { provider: true } });
  if (!request) return privateJson({ error: "Not found" }, { status: 404 });
  if (request.status !== "pending") return privateJson({ error: "Already reviewed" }, { status: 409 });
  // A field proposal needs the regulator's sign-off before admin can act —
  // mirrored client-side in CorporateRequestReview.tsx's disabled Approve
  // button, enforced here as the actual gate.
  if (
    parsed.data.action === "approve" &&
    request.type === "new_field" &&
    request.regulatorDecision !== "approved"
  ) {
    return privateJson({ error: "Waiting on regulator sign-off before this can be approved" }, { status: 409 });
  }

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

  if (request.type === "new_field") {
    if (!request.categoryId) return privateJson({ error: "Request has no category" }, { status: 400 });
    const proposedField = request.proposedData as ProposedField;

    // isComparable defaults false — the field exists and the business can
    // start populating it, but it stays invisible to consumers until an
    // admin explicitly flips it on (see the isComparable toggle in
    // /admin/catalog), matching the docs' "Regulatory/Admin approves ->
    // Consumer sees it" only as the very last step.
    const field = await prisma.attributeSchemaField.create({
      data: {
        categoryId: request.categoryId,
        key: proposedField.key,
        label: proposedField.label,
        consumerLabel: proposedField.consumerLabel ?? null,
        dataType: proposedField.dataType,
        unit: proposedField.unit ?? null,
        qualityAxis: proposedField.qualityAxis ?? null,
        isComparable: false,
      },
    });

    await prisma.corporateRequest.update({
      where: { id },
      data: {
        status: "approved",
        reviewedByEmail: admin.email,
        reviewedAt: new Date(),
        reviewNote: parsed.data.note ?? null,
      },
    });
    await logAdminAction({
      adminEmail: admin.email,
      action: "corporate_request_approved",
      targetType: "corporate_request",
      targetId: id,
      detail: `Approved new_field request from "${request.provider.name}" — created field "${field.label}" (${field.key}), not yet consumer-visible`,
    });

    revalidateCatalog();
    return privateJson({ ok: true, fieldId: field.id });
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
    data: {
      status: "approved",
      reviewedByEmail: admin.email,
      reviewedAt: new Date(),
      reviewNote: parsed.data.note ?? null,
    },
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
