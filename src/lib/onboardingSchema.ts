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
// orgDetails/industry/applicationDetails — a set of labeled document uploads
// plus an optional custom-dashboard request. `documents` is shape-only
// validated here (an array of {label, url} pairs); *which* labels are
// actually required for a given role (regulator needs its one slot, corporate
// needs at least one of its three, provider needs none) is enforced
// client-side on the "verification" step's Continue button, not here — see
// that step's canContinue() in src/app/signup/page.tsx and the comment on
// onboardingBodySchema below for why this isn't a server-side .refine().
// route.ts sets applicationStatus: "pending" for these roles regardless of
// how many documents were actually uploaded.
const verificationFieldsSchema = {
  // {label, url}[] — label is our own fixed per-role slot name (e.g.
  // "Certificate of Incorporation"), url is returned by POST
  // /api/onboarding/verification-docs. The url is never a client-supplied
  // arbitrary string in the security sense that matters, since that route
  // uploads to our own MinIO bucket and hands back its own public URL, same
  // trust boundary as providerListingSchema's image URLs.
  documents: z
    .array(z.object({ label: z.string().min(1).max(100), url: z.string() }))
    .max(10)
    .default([]),
  customInterfaceRequested: z.boolean().default(false),
  customInterfaceNotes: z.string().trim().max(1000).optional(),
  // Free-text "why are you applying?" on the "declarations" step — optional
  // for every role.
  whyApplying: z.string().trim().max(500).optional(),
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
  // "applicationDetails" step — all optional, folded into User.
  // applicationDetails as a Json blob by route.ts rather than becoming
  // dozens of columns (see that field's comment in schema.prisma).
  registrationNumber: z.string().trim().max(100).optional(),
  taxNumber: z.string().trim().max(100).optional(),
  registeredAddress: z.string().trim().max(300).optional(),
  yearEstablished: z.string().trim().max(4).optional(),
  contactName: z.string().trim().max(100).optional(),
  contactTitle: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  employeeCountBand: z.string().optional(),
  monthlyVolumeBand: z.string().optional(),
  consents: consentsSchema,
  ...verificationFieldsSchema,
  // "declarations" step — both required for corporate, unlike regulator
  // below which swaps dataProtectionComplianceDeclared for
  // authorizedToActDeclared.
  accurateInfoDeclared: z.literal(true),
  dataProtectionComplianceDeclared: z.literal(true),
});

// The informal-sector provider persona (see HANDOFF.md: a kiosk operator, a
// small insurance agent) deliberately has no domain requirement — that
// friction would exclude exactly the target user.
const providerSchema = z.object({
  role: z.literal("provider"),
  businessName: z.string().min(1),
  businessDescription: z.string().trim().max(300).optional(),
  // "applicationDetails" step — all optional, same reasoning as corporate's.
  businessType: z.string().optional(),
  registeredAddress: z.string().trim().max(300).optional(),
  yearsOperating: z.string().trim().max(50).optional(),
  contactName: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  estimatedMonthlyListingVolume: z.string().optional(),
  consents: consentsSchema,
  ...verificationFieldsSchema,
  accurateInfoDeclared: z.literal(true),
  dataProtectionComplianceDeclared: z.literal(true),
});

// regulatorName must be one of REGULATOR_NAMES, then route.ts checks the
// authenticated email's domain against that specific regulator's known
// domain — an open text field here would be the same hole HANDOFF.md closed.
const regulatorSchema = z.object({
  role: z.literal("regulator"),
  regulatorName: z.enum(REGULATOR_NAMES),
  // "applicationDetails" step — all optional, same reasoning as corporate's.
  jurisdiction: z.string().trim().max(500).optional(),
  contactName: z.string().trim().max(100).optional(),
  contactTitle: z.string().trim().max(100).optional(),
  contactPhone: z.string().trim().max(30).optional(),
  officialCapacity: z.string().trim().max(200).optional(),
  consents: consentsSchema,
  ...verificationFieldsSchema,
  // Regulator access is the most sensitive of the three applicant roles, so
  // its declaration swaps out data-protection-compliance for an explicit
  // claim of institutional authority — see the field's comment in
  // schema.prisma.
  accurateInfoDeclared: z.literal(true),
  authorizedToActDeclared: z.literal(true),
});

export const onboardingBodySchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("role" in value) ? { ...value, role: "consumer" } : value,
  z.discriminatedUnion("role", [consumerSchema, corporateSchema, providerSchema, regulatorSchema]),
);
