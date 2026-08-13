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

// A corporate account only ever proposes a change — reason is required
// (these are formal, audited accounts, unlike the informal provider
// self-edit flow which has no equivalent field) and the request always
// lands as `pending`; the route never lets the client set the status.
export const createCorporateRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("edit"),
    listingId: z.string(),
    proposedData: proposedDataSchema,
    reason: z.string().trim().min(1).max(1000),
  }),
  z.object({
    type: z.literal("new_listing"),
    categoryId: z.string(),
    proposedData: proposedDataSchema,
    reason: z.string().trim().min(1).max(1000),
  }),
]);
