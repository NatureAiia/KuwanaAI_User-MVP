import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { bulkPriceUpdateSchema } from "@/lib/bulkPriceUpdateSchema";
import { recordPriceChange, logListingUpdate } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";

export type BulkPriceUpdateResult = { listingId: string; ok: boolean; error?: string };

/**
 * CSV bulk-upload of price changes, reinterpreted onto the same direct-write
 * path a single corporate edit already uses (PATCH /api/corporate/listings/
 * [id]) — a business editing 40 of its own listings at once still doesn't
 * need admin review, it's just the same operation looped. Each row is
 * independent: one bad listing id doesn't fail the whole batch.
 */
export async function POST(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const parsed = bulkPriceUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const results: BulkPriceUpdateResult[] = [];

  for (const row of parsed.data.rows) {
    const existing = await prisma.listing.findUnique({ where: { id: row.listingId } });
    if (!existing || existing.providerId !== auth.provider.id) {
      results.push({ listingId: row.listingId, ok: false, error: "Not one of your listings" });
      continue;
    }

    await prisma.listing.update({
      where: { id: row.listingId },
      data: { price: row.price, lastVerifiedAt: new Date(), freshnessStatus: "fresh", lastUpdateSource: "corporate" },
    });

    if (Number(existing.price) !== row.price) {
      await recordPriceChange(row.listingId, Number(existing.price));
    }
    await logListingUpdate({
      listingId: row.listingId,
      source: "corporate",
      actorLabel: auth.provider.name,
      changeSummary: row.reason,
    });

    results.push({ listingId: row.listingId, ok: true });
  }

  revalidateCatalog();
  return privateJson({ results });
}
