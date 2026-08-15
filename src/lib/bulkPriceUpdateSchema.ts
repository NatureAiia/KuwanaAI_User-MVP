import { z } from "zod";

// Deliberately narrower than corporateListingUpdateSchema (price + reason
// only, no name/description/attributes/images) — a CSV row identifying a
// listing by id and giving it a new price is the one bulk operation common
// enough to justify a generic import format; anything richer stays a
// one-at-a-time edit through /corporate/products.
export const bulkPriceUpdateRowSchema = z.object({
  listingId: z.string().uuid(),
  price: z.number().positive().max(100_000_000),
  reason: z.string().trim().min(1).max(1000),
});

export const bulkPriceUpdateSchema = z.object({
  rows: z.array(bulkPriceUpdateRowSchema).min(1).max(200),
});

export type BulkPriceUpdateRow = z.infer<typeof bulkPriceUpdateRowSchema>;
