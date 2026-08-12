import { describe, expect, it } from "vitest";
import { planTiers, scoreComplexity } from "./tiers";

const LADDER = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "claude-haiku-4-5",
  "claude-opus-5",
];

describe("scoreComplexity", () => {
  it("scores a short lookup near zero", () => {
    expect(scoreComplexity({ feature: "intake", query: "cheap data" })).toBeLessThan(0.1);
  });

  it("scores a long multi-clause need higher than a short one", () => {
    const simple = scoreComplexity({ feature: "intake", query: "data bundle" });
    const complex = scoreComplexity({
      feature: "intake",
      query:
        "I need mobile data for my small shop and also a savings account that does not charge monthly fees, which should I look at first?",
    });
    expect(complex).toBeGreaterThan(simple);
  });

  it("scales recommendations with how many listings and attributes are in play", () => {
    const pair = scoreComplexity({
      feature: "recommendations",
      listingCount: 2,
      comparableAttributes: 3,
      hasPriceTrends: false,
    });
    const wide = scoreComplexity({
      feature: "recommendations",
      listingCount: 6,
      comparableAttributes: 12,
      hasPriceTrends: true,
    });
    expect(pair).toBeLessThan(0.1);
    expect(wide).toBeGreaterThan(0.8);
  });

  it("treats an attached image as a large jump in chat complexity", () => {
    const text = scoreComplexity({
      feature: "chat",
      hasImage: false,
      turnCount: 1,
      messageLength: 30,
      groundedListings: 0,
    });
    const withImage = scoreComplexity({
      feature: "chat",
      hasImage: true,
      turnCount: 1,
      messageLength: 30,
      groundedListings: 0,
    });
    expect(withImage - text).toBeGreaterThanOrEqual(0.45);
  });

  it("never leaves the 0..1 range even on extreme input", () => {
    const huge = scoreComplexity({
      feature: "chat",
      hasImage: true,
      turnCount: 500,
      messageLength: 100_000,
      groundedListings: 99,
    });
    expect(huge).toBeGreaterThanOrEqual(0);
    expect(huge).toBeLessThanOrEqual(1);
  });
});

describe("planTiers", () => {
  it("starts on the cheapest rung for trivial work", () => {
    const plan = planTiers({ ladder: LADDER, complexity: 0 });
    expect(plan.startIndex).toBe(0);
    expect(plan.candidates[0].id).toBe("nvidia/nemotron-3-super-120b-a12b:free");
    expect(plan.candidates).toHaveLength(3);
  });

  it("starts on the top rung for maximal complexity and leaves nothing to escalate to", () => {
    const plan = planTiers({ ladder: LADDER, complexity: 1 });
    expect(plan.candidates.map((m) => m.id)).toEqual(["claude-opus-5"]);
  });

  it("never offers a rung below the starting one", () => {
    const plan = planTiers({ ladder: LADDER, complexity: 0.5 });
    expect(plan.startIndex).toBe(1);
    expect(plan.candidates.map((m) => m.id)).toEqual(["claude-haiku-4-5", "claude-opus-5"]);
  });

  it("drops rungs that cannot read images when vision is required", () => {
    const plan = planTiers({ ladder: LADDER, complexity: 0, requireVision: true });
    expect(plan.candidates.every((m) => m.vision)).toBe(true);
    expect(plan.candidates.map((m) => m.id)).toEqual(["claude-haiku-4-5", "claude-opus-5"]);
  });

  it("falls back to the strongest rung when vision is required and none supports it", () => {
    const plan = planTiers({
      ladder: ["nvidia/nemotron-3-super-120b-a12b:free", "nvidia/nemotron-3-nano-30b-a3b"],
      complexity: 0,
      requireVision: true,
    });
    expect(plan.candidates.map((m) => m.id)).toEqual(["nvidia/nemotron-3-nano-30b-a3b"]);
  });

  it("ignores model ids that are no longer in the catalog", () => {
    const plan = planTiers({ ladder: ["retired/model", "claude-haiku-4-5"], complexity: 0 });
    expect(plan.candidates.map((m) => m.id)).toEqual(["claude-haiku-4-5"]);
  });

  it("falls back to a known model rather than returning nothing", () => {
    const plan = planTiers({ ladder: [], complexity: 0 });
    expect(plan.candidates).toHaveLength(1);
    expect(plan.candidates[0].id).toBe("claude-opus-5");
  });
});
