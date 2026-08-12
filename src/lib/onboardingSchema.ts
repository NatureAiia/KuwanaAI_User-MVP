import { z } from "zod";
import { REGULATOR_NAMES } from "@/lib/orgVerification";

// The public self-service signup endpoint's request schema. Corporate and
// Regulator used to be hardcoded out of this schema entirely (see
// HANDOFF.md's "Security — do not reopen these"): the client could assert
// any role with nothing to back it up. They're back here deliberately, each
// paired with a real server-side check in src/app/api/onboarding/route.ts
// (a work-email-domain check for Corporate, an exact regulator-domain match
// for Regulator) keyed off the *authenticated* Supabase email — never the
// request body. Admin is still not, and will never be, a self-service role:
// it isn't even a value in the `Role` enum, it's the ADMIN_EMAILS allowlist.
// Kept in its own module (rather than exported straight from
// src/app/api/onboarding/route.ts) since Next.js route files only permit
// specific recognized exports.
const consentsSchema = z.object({
  research_use: z.boolean(),
  leaderboard_participation: z.boolean(),
  // Separate from research_use — health data warrants its own opt-in,
  // matching the granular consent split from the original wireframes
  // (only meaningful for consumers who submit a healthcareFootprint, but
  // harmless to store either way, same as the other two consent types).
  health_data_sharing: z.boolean().optional(),
});

const consumerSchema = z.object({
  role: z.literal("consumer"),
  fullName: z.string().min(1),
  ageRange: z.string().optional(),
  occupation: z.string().optional(),
  location: z.string().optional(),
  socialPlatforms: z.array(z.string()).default([]),
  telecomFootprint: z
    .object({
      primary_network: z.string(),
      plan_type: z.string(),
      monthly_spend_range: z.string(),
    })
    .optional(),
  bankingFootprint: z
    .object({
      // Multi-select: a user can hold accounts at any combination of the
      // banks listed in src/lib/onboarding-options.ts (CBZ + Steward +
      // Stanbic etc.). "I don't bank" stays out of this array — the
      // presence of the footprint itself is the signal the user banks.
      banks: z.array(z.string()).min(1),
      account_types: z.array(z.string()).default([]),
      // Mobile wallets (EcoCash/OneMoney/InnBucks/etc.) are tracked
      // separately from bank account types because they're issued by
      // telecoms/fintechs, not banks. Optional and free-text — same
      // string-array shape as `account_types` for the same reason.
      wallets: z.array(z.string()).default([]),
    })
    .optional(),
  insuranceFootprint: z
    .object({
      // Multi-select: a user can be covered by more than one insurer
      // (e.g. a life policy with Old Mutual + a funeral policy with
      // ZIMNAT). "I don't have insurance" is an exclusive sentinel kept
      // out of this array — its presence as the *only* entry is the
      // signal the user is uninsured. Same pattern as
      // `bankingFootprint.banks`.
      providers: z.array(z.string()).min(1),
      policy_types: z.array(z.string()).default([]),
      has_insurance: z.boolean(),
    })
    .optional(),
  healthcareFootprint: z
    .object({
      // Multi-select: a person can belong to more than one medical aid
      // scheme (e.g. workplace PSMAS + private family cover at Cimas).
      // "None" and "Public hospital only" are exclusive sentinels kept out
      // of this array — whichever is present as the *only* entry signals
      // no private scheme. Same pattern as `insuranceFootprint.providers`.
      medical_aid_providers: z.array(z.string()).min(1),
      chronic_condition_disclosure_opt_in: z.boolean(),
    })
    .optional(),
  consents: consentsSchema,
});

// Verified against the authenticated email's domain in route.ts — a
// personal-email domain (gmail.com, yahoo.com, ...) is rejected there even
// though it'd pass this schema.
const corporateSchema = z.object({
  role: z.literal("corporate"),
  organizationName: z.string().min(1),
  consents: consentsSchema,
});

// The informal-sector provider persona (see HANDOFF.md: a kiosk operator, a
// small insurance agent) deliberately has no domain requirement — that
// friction would exclude exactly the target user.
const providerSchema = z.object({
  role: z.literal("provider"),
  businessName: z.string().min(1),
  consents: consentsSchema,
});

// regulatorName must be one of REGULATOR_NAMES, then route.ts checks the
// authenticated email's domain against that specific regulator's known
// domain — an open text field here would be the same hole HANDOFF.md closed.
const regulatorSchema = z.object({
  role: z.literal("regulator"),
  regulatorName: z.enum(REGULATOR_NAMES),
  consents: consentsSchema,
});

export const onboardingBodySchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("role" in value) ? { ...value, role: "consumer" } : value,
  z.discriminatedUnion("role", [consumerSchema, corporateSchema, providerSchema, regulatorSchema]),
);
