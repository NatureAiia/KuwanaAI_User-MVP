import { z } from "zod";
import { boundedJsonRecord } from "@/lib/zodShared";

// A category's attribute schema is a handful of fields; the largest seeded
// listing has ~8. Bounding this stops a linked provider account from using
// its one legitimate write path as a bulk-storage channel.
const listingAttributes = boundedJsonRecord(50, 16_000);

// A provider can only ever start a listing as draft or send it straight to
// review — never publish or reject its own submission. Kept separate from
// route.ts for the same reason as onboardingSchema.ts/adminUserSchema.ts:
// route files only permit specific recognized exports, and this way it's
// independently testable.
export const providerCreateListingSchema = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(200),
  attributes: listingAttributes,
  price: z.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).default("USD"),
  sourceUrl: z.string().url().max(2000).optional(),
  status: z.enum(["draft", "pending_review"]).default("draft"),
});

// Editing/resubmitting only makes sense while a listing hasn't been acted
// on by an admin yet (draft/pending_review) or after a rejection (fix and
// resend to pending_review) — the route itself enforces which prior status
// allows which transition, not this schema.
export const providerUpdateListingSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  attributes: listingAttributes.optional(),
  price: z.number().positive().max(100_000_000).optional(),
  currency: z.string().trim().length(3).optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  status: z.enum(["draft", "pending_review"]).optional(),
});
