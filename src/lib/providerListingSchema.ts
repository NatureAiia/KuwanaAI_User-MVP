import { z } from "zod";

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
  status: z.enum(["draft", "pending_review"]).optional(),
});
