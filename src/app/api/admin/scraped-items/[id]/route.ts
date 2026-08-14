import { z } from "zod";
import { Prisma } from "@prisma/client";
import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { recordPriceChange, logListingUpdate } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";
import { boundedJsonRecord } from "@/lib/zodShared";

const editsSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  price: z.number().positive().max(100_000_000).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  description: z.string().max(2000).nullable().optional(),
  attributes: boundedJsonRecord(50, 16_000).optional(),
  categoryId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), edits: editsSchema.optional() }),
  z.object({ action: z.literal("reject"), reason: z.string().max(500).optional() }),
]);

type ExtractedFields = {
  name?: string;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  attributes?: Record<string, unknown>;
};

/** Approve or reject a scraped candidate. Never called on anything but a still-pending item. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const item = await prisma.scrapedItem.findUnique({ where: { id } });
  if (!item) return privateJson({ error: "Not found" }, { status: 404 });
  if (item.status !== "pending") return privateJson({ error: "Already reviewed" }, { status: 409 });

  if (parsed.data.action === "reject") {
    await prisma.scrapedItem.update({
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
      action: "scrape_item_rejected",
      targetType: "scraped_item",
      targetId: id,
      detail: `Rejected scraped item from ${item.sourceUrl}${parsed.data.reason ? `: ${parsed.data.reason}` : ""}`,
    });
    return privateJson({ ok: true });
  }

  const extracted = item.extractedData as ExtractedFields;
  const edits = parsed.data.edits ?? {};

  const name = edits.name ?? extracted.name;
  const price = edits.price ?? (typeof extracted.price === "number" ? extracted.price : undefined);
  const currency = edits.currency ?? extracted.currency ?? "USD";
  const description = edits.description !== undefined ? edits.description : extracted.description ?? null;
  const attributes = edits.attributes ?? extracted.attributes ?? {};

  if (!name) return privateJson({ error: "This candidate has no name — provide one in edits" }, { status: 400 });
  if (price === undefined) {
    return privateJson({ error: "This candidate has no price — provide one in edits" }, { status: 400 });
  }

  let listingId: string;

  if (item.suggestedListingId) {
    const previous = await prisma.listing.findUnique({
      where: { id: item.suggestedListingId },
      select: { price: true },
    });
    const listing = await prisma.listing.update({
      where: { id: item.suggestedListingId },
      data: {
        name,
        description,
        price,
        currency,
        attributes: attributes as Prisma.InputJsonValue,
        sourceUrl: item.sourceUrl,
        status: "published",
        rejectionReason: null,
        lastVerifiedAt: new Date(),
        freshnessStatus: "fresh",
        lastUpdateSource: "scraper",
      },
    });
    if (previous && Number(previous.price) !== price) {
      await recordPriceChange(listing.id, Number(previous.price));
    }
    await logListingUpdate({
      listingId: listing.id,
      source: "scraper",
      actorLabel: "Web scraper",
      changeSummary: `Updated from ${item.sourceUrl}`,
    });
    listingId = listing.id;
  } else {
    const providerId = edits.providerId ?? item.suggestedProviderId;
    const categoryId = edits.categoryId ?? item.categoryId;
    if (!providerId) {
      return privateJson({ error: "No matching provider — provide providerId in edits" }, { status: 400 });
    }
    if (!categoryId) {
      return privateJson({ error: "No category set — provide categoryId in edits" }, { status: 400 });
    }

    // Never seen before: land as pending_review rather than live, so this
    // still passes through /admin/catalog's own review once — a new
    // provider/category mapping is exactly the case worth a second look.
    const listing = await prisma.listing.create({
      data: {
        categoryId,
        providerId,
        name,
        description,
        price,
        currency,
        attributes: attributes as Prisma.InputJsonValue,
        sourceUrl: item.sourceUrl,
        status: "pending_review",
        freshnessStatus: "unverified",
        lastUpdateSource: "scraper",
      },
    });
    await logListingUpdate({
      listingId: listing.id,
      source: "scraper",
      actorLabel: "Web scraper",
      changeSummary: `Discovered from ${item.sourceUrl}`,
    });
    listingId = listing.id;
  }

  await prisma.scrapedItem.update({
    where: { id },
    data: { status: "approved", reviewedByEmail: admin.email, reviewedAt: new Date() },
  });
  await logAdminAction({
    adminEmail: admin.email,
    action: "scrape_item_approved",
    targetType: "scraped_item",
    targetId: id,
    detail: `Approved scraped item from ${item.sourceUrl} into listing "${name}"`,
  });

  revalidateCatalog();
  return privateJson({ ok: true, listingId });
}
