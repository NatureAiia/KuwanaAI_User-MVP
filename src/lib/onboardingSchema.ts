import { z } from "zod";

// This is the public self-service signup endpoint's request schema —
// Corporate/Regulator are deliberately not acceptable values for `role`.
// The build plan is explicit that those roles are admin-invited only, never
// self-registered (a corporate account gains "Market Intelligence"
// visibility, a regulator account gains "Compliance & Market Monitoring"
// visibility — neither should be grantable by a client simply asserting a
// role in a POST body). Consumer is the only role this MVP's self-serve
// signup ever assigns. Kept in its own module (rather than exported
// straight from src/app/api/onboarding/route.ts) since Next.js route files
// only permit specific recognized exports.
export const onboardingBodySchema = z.object({
  role: z.literal("consumer").default("consumer"),
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
      bank_name: z.string(),
      account_types: z.array(z.string()).default([]),
    })
    .optional(),
  insuranceFootprint: z
    .object({
      provider: z.string(),
      policy_types: z.array(z.string()).default([]),
      has_insurance: z.boolean(),
    })
    .optional(),
  healthcareFootprint: z
    .object({
      medical_aid_provider: z.string(),
      chronic_condition_disclosure_opt_in: z.boolean(),
    })
    .optional(),
  consents: z.object({
    research_use: z.boolean(),
    leaderboard_participation: z.boolean(),
    // Separate from research_use — health data warrants its own opt-in,
    // matching the granular consent split from the original wireframes
    // (only meaningful for consumers who submit a healthcareFootprint, but
    // harmless to store either way, same as the other two consent types).
    health_data_sharing: z.boolean().optional(),
  }),
});
