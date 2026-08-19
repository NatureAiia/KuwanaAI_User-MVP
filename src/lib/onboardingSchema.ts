import { z } from "zod";
import { REGULATOR_NAMES } from "@/lib/orgVerification";
import { SECTORS, type SectorSlug } from "@/lib/sectors";

const SECTOR_SLUGS = Object.keys(SECTORS) as [SectorSlug, ...SectorSlug[]];

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

// Captured on the "verification" step corporate/provider/regulator see after
// orgDetails/industry — a business registration/ID document upload plus an
// optional custom-dashboard request. All optional: this step's document
// upload can fail (no MinIO configured, network hiccup) without blocking
// account creation, and route.ts sets applicationStatus: "pending" for these
// roles regardless of whether any of this was filled in.
const verificationFieldsSchema = {
  // URLs returned by POST /api/onboarding/verification-docs — never
  // client-supplied arbitrary strings in the security sense that matters,
  // since that route uploads to our own MinIO bucket and hands back its own
  // public URL, same trust boundary as providerListingSchema's image URLs.
  verificationDocumentUrls: z.array(z.string()).max(10).default([]),
  customInterfaceRequested: z.boolean().default(false),
  customInterfaceNotes: z.string().trim().max(1000).optional(),
};

const consumerSchema = z.object({
  role: z.literal("consumer"),
  // A unique handle, not a display name — enforced unique on `users.username`
  // in route.ts/schema.prisma. Restricted to a safe ID charset since it's
  // used as a stable identifier, not just shown on a profile.
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
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
  // Short blurb shown alongside the business name (Provider.description) —
  // only meaningful the first time a company signs up, since it seeds the
  // Provider record; a later joiner from the same domain submits one too,
  // but route.ts only uses it when the Provider doesn't already exist yet.
  organizationDescription: z.string().trim().max(300).optional(),
  // Which market this account operates in — defaults the Market
  // Intelligence dashboard to their own sector instead of an unfiltered
  // all-sectors view (see src/app/corporate/page.tsx).
  primarySector: z.enum(SECTOR_SLUGS),
  consents: consentsSchema,
  ...verificationFieldsSchema,
});

// The informal-sector provider persona (see HANDOFF.md: a kiosk operator, a
// small insurance agent) deliberately has no domain requirement — that
// friction would exclude exactly the target user.
const providerSchema = z.object({
  role: z.literal("provider"),
  businessName: z.string().min(1),
  businessDescription: z.string().trim().max(300).optional(),
  consents: consentsSchema,
  ...verificationFieldsSchema,
});

// regulatorName must be one of REGULATOR_NAMES, then route.ts checks the
// authenticated email's domain against that specific regulator's known
// domain — an open text field here would be the same hole HANDOFF.md closed.
const regulatorSchema = z.object({
  role: z.literal("regulator"),
  regulatorName: z.enum(REGULATOR_NAMES),
  consents: consentsSchema,
  ...verificationFieldsSchema,
});

export const onboardingBodySchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("role" in value) ? { ...value, role: "consumer" } : value,
  z.discriminatedUnion("role", [consumerSchema, corporateSchema, providerSchema, regulatorSchema]),
);
