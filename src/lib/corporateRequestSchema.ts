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

// A corporate account proposing a brand-new comparable field for its
// category (see prisma/schema.prisma's CorporateRequestType.new_field and
// AttributeSchemaField). `key` must be a stable slug — validated the same
// way field_definitions' slug is described in the uploaded docs: lowercase,
// snake_case, no spaces.
const proposedFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase snake_case, e.g. nostro_fca_min_balance"),
  label: z.string().trim().min(1).max(100),
  consumerLabel: z.string().trim().min(1).max(100).nullable().optional(),
  dataType: z.enum(["number", "string", "enum", "boolean"]),
  unit: z.string().trim().max(20).nullable().optional(),
  qualityAxis: z.enum(["value", "trust", "availability", "performance", "resilience"]).nullable().optional(),
  // Illustrates the field on the review card — never written to a Listing;
  // the business fills the real value in later via its own attributes JSON.
  sampleValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

// Only "new_listing" and "new_field" go through this request/review flow —
// a never-before-seen product or a brand-new comparable field are exactly
// the cases worth Kuwana's first look (same reasoning as ScrapedItem's
// pending/approved/rejected state for a brand-new candidate). Editing a
// listing the business already owns is a direct write instead (PATCH
// /api/corporate/listings/[id]) since it's their own data — see
// corporateListingSchema.ts.
export const createCorporateRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("new_listing"),
    categoryId: z.string(),
    proposedData: proposedDataSchema,
    reason: z.string().trim().min(1).max(1000),
  }),
  z.object({
    type: z.literal("new_field"),
    categoryId: z.string(),
    proposedData: proposedFieldSchema,
    reason: z.string().trim().min(1).max(1000),
  }),
]);
