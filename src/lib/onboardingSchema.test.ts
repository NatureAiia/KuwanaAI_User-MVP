import { describe, expect, it } from "vitest";
import { onboardingBodySchema } from "@/lib/onboardingSchema";

const CONSENTS = { research_use: false, leaderboard_participation: false };

describe("onboardingBodySchema role", () => {
  it("accepts an explicit role: consumer", () => {
    const result = onboardingBodySchema.safeParse({
      role: "consumer",
      fullName: "Test User",
      consents: CONSENTS,
    });
    expect(result.success).toBe(true);
  });

  it("defaults role to consumer when omitted", () => {
    const result = onboardingBodySchema.safeParse({ fullName: "Test User", consents: CONSENTS });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("consumer");
  });

  // Corporate/Provider/Regulator are schema-valid shapes, but that's not the
  // security boundary — route.ts additionally verifies each against the
  // *authenticated* email's domain before ever writing the role. See
  // HANDOFF.md and src/lib/orgVerification.ts.
  it("accepts role: corporate with an organizationName", () => {
    const result = onboardingBodySchema.safeParse({
      role: "corporate",
      organizationName: "CBZ Bank",
      consents: CONSENTS,
    });
    expect(result.success).toBe(true);
  });

  it("accepts role: provider with a businessName", () => {
    const result = onboardingBodySchema.safeParse({
      role: "provider",
      businessName: "Tendai's Kiosk",
      consents: CONSENTS,
    });
    expect(result.success).toBe(true);
  });

  it("accepts role: regulator with a known regulatorName", () => {
    const result = onboardingBodySchema.safeParse({
      role: "regulator",
      regulatorName: "POTRAZ",
      consents: CONSENTS,
    });
    expect(result.success).toBe(true);
  });

  it("rejects role: regulator with an unrecognized regulatorName", () => {
    const result = onboardingBodySchema.safeParse({
      role: "regulator",
      regulatorName: "Not A Real Regulator",
      consents: CONSENTS,
    });
    expect(result.success).toBe(false);
  });

  it("rejects role: corporate missing organizationName", () => {
    const result = onboardingBodySchema.safeParse({ role: "corporate", consents: CONSENTS });
    expect(result.success).toBe(false);
  });

  // Admin is not, and must never become, a value this schema accepts — it
  // isn't a Role at all, just the ADMIN_EMAILS allowlist (see
  // src/lib/auth.ts requireAdmin). Unlike corporate/provider/regulator,
  // there is deliberately no branch for it above.
  it("rejects role: admin — it is not a self-service role and never will be", () => {
    const result = onboardingBodySchema.safeParse({ role: "admin", consents: CONSENTS });
    expect(result.success).toBe(false);
  });
});
