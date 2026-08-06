import { z } from "zod";

// Every listing image must come back from our own upload endpoint
// (POST /api/provider/listings/images), which writes into this exact
// bucket path — otherwise a provider could PATCH an arbitrary external URL
// straight onto a public listing card, a real content-injection surface
// (unlike sourceUrl, which is just an outbound link, never rendered as
// <img src>).
export const LISTING_IMAGE_URL_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/listing-images/`;

const listingImageUrl = z
  .string()
  .url()
  .refine((url) => url.startsWith(LISTING_IMAGE_URL_PREFIX), {
    message: "Image URL must come from Kuwana's own upload endpoint",
  });

// A provider can only ever start a listing as draft or send it straight to
// review — never publish or reject its own submission. Kept separate from
// route.ts for the same reason as onboardingSchema.ts/adminUserSchema.ts:
// route files only permit specific recognized exports, and this way it's
// independently testable.
export const providerCreateListingSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  sourceUrl: z.string().url().optional(),
  images: z.array(listingImageUrl).max(8).default([]),
  status: z.enum(["draft", "pending_review"]).default("draft"),
});

// Editing/resubmitting only makes sense while a listing hasn't been acted
// on by an admin yet (draft/pending_review) or after a rejection (fix and
// resend to pending_review) — the route itself enforces which prior status
// allows which transition, not this schema.
export const providerUpdateListingSchema = z.object({
  name: z.string().min(1).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  price: z.number().positive().optional(),
  currency: z.string().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  images: z.array(listingImageUrl).max(8).optional(),
  status: z.enum(["draft", "pending_review"]).optional(),
});
