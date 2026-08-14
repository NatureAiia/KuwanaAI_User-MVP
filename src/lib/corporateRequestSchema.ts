import { z } from "zod";
import { boundedJsonRecord } from "@/lib/zodShared";

// Same bound as providerListingSchema.ts's attributes — a category's schema
// is a handful of fields; this just stops the write path being abused as
// bulk JSON storage.
const listingAttributes = boundedJsonRecord(50, 16_000);

const proposedDataSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  price: z.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).default("USD"),
  attributes: listingAttributes,
  images: z.array(z.string().url()).max(8).default([]),
});

// Only "new_listing" goes through this request/review flow now — a
// never-before-seen product is exactly the case worth Kuwana's first look
// (same reasoning as ScrapedItem's pending/approved/rejected state for a
// brand-new candidate). Editing a listing the business already owns is a
// direct write instead (PATCH /api/corporate/listings/[id]) since it's
// their own data — see corporateListingSchema.ts.
export const createCorporateRequestSchema = z.object({
  type: z.literal("new_listing"),
  categoryId: z.string(),
  proposedData: proposedDataSchema,
  reason: z.string().trim().min(1).max(1000),
});
