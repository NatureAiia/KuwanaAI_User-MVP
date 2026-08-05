import { describe, expect, it } from "vitest";
import { onboardingBodySchema } from "@/lib/onboardingSchema";

const BASE = {
  fullName: "Test User",
  consents: { research_use: false, leaderboard_participation: false },
};

describe("onboardingBodySchema role", () => {
  it("accepts an explicit role: consumer", () => {
    const result = onboardingBodySchema.safeParse({ ...BASE, role: "consumer" });
    expect(result.success).toBe(true);
  });

  it("defaults role to consumer when omitted", () => {
    const result = onboardingBodySchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe("consumer");
  });

  it.each(["regulator", "corporate", "provider", "admin"])(
    "rejects role: %s — the public signup endpoint must never grant elevated roles",
    (role) => {
      const result = onboardingBodySchema.safeParse({ ...BASE, role });
      expect(result.success).toBe(false);
    },
  );
});
