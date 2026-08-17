import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { bulkPriceUpdateSchema, type BulkPriceUpdateRow } from "@/lib/bulkPriceUpdateSchema";
import { recordPriceChange, logListingUpdate } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export type BulkPriceUpdateResult = { listingId: string; ok: boolean; error?: string };

// Rows are processed in fixed-size batches, each row's DB calls run
// concurrently within the batch, so one request never holds a fully
// sequential chain of up to 200 rows x ~4 awaits open on a single connection.
const BATCH_SIZE = 10;

async function processRow(
  row: BulkPriceUpdateRow,
  providerId: string,
  providerName: string,
): Promise<BulkPriceUpdateResult> {
  const existing = await prisma.listing.findUnique({ where: { id: row.listingId } });
  if (!existing || existing.providerId !== providerId) {
    return { listingId: row.listingId, ok: false, error: "Not one of your listings" };
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
    actorLabel: providerName,
    changeSummary: row.reason,
  });

  return { listingId: row.listingId, ok: true };
}

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

  const limited = await enforceRateLimit(`bulk-price-update:${auth.provider.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = bulkPriceUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const results: BulkPriceUpdateResult[] = [];
  const { rows } = parsed.data;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((row) => processRow(row, auth.provider.id, auth.provider.name)),
    );
    results.push(...batchResults);
  }

  revalidateCatalog();
  return privateJson({ results });
}
