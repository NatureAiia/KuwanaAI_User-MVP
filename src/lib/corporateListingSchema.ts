import { z } from "zod";
import { boundedJsonRecord } from "@/lib/zodShared";
import { LISTING_IMAGE_URL_PREFIX } from "@/lib/providerListingSchema";

// Same bound as providerListingSchema.ts's attributes — a category's schema
// is a handful of fields; this just stops the one legitimate write path
// being used as bulk JSON storage.
const listingAttributes = boundedJsonRecord(50, 16_000);

const listingImageUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith(LISTING_IMAGE_URL_PREFIX), {
    message: "Image URL must come from Kuwana's own upload endpoint",
  });

// A corporate account edits a listing it already owns directly — no
// draft/pending_review status field here at all, unlike
// providerUpdateListingSchema: this never changes Listing.status, it only
// ever corrects the data on an already-published row. `reason` is required
// (these are formal, audited accounts) and becomes the ListingUpdateLog's
// changeSummary.
export const corporateListingUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  attributes: listingAttributes.optional(),
  price: z.number().positive().max(100_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  images: z.array(listingImageUrl).max(8).optional(),
  reason: z.string().trim().min(1).max(1000),
});
