import { describe, expect, it } from "vitest";
import { buildFactQueue } from "@/lib/onboarding-facts";

describe("buildFactQueue", () => {
  it("includes a selected provider's facts", () => {
    const queue = buildFactQueue(["Econet"]);
    expect(queue).toContain(
      "Econet launched in 1998 as Zimbabwe's first private mobile network, after a 5-year legal battle that ended the state telecoms monopoly.",
    );
  });

  it("always appends the generic facts as filler", () => {
    const queue = buildFactQueue([]);
    expect(queue).toContain("Building your Kuwana profile takes under a minute and unlocks personalized comparisons immediately.");
  });

  it("ignores null/undefined selections without throwing", () => {
    expect(() => buildFactQueue([null, undefined, "Econet"])).not.toThrow();
    expect(buildFactQueue([null, undefined])).toEqual(buildFactQueue([]));
  });

  it("silently skips a selection with no known facts (never seen provider)", () => {
    const queue = buildFactQueue(["Some Brand New Bank"]);
    // Falls back to just the generic facts, no crash, no placeholder text.
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((f) => typeof f === "string")).toBe(true);
  });

  it("dedupes when two selections share overlapping fact text", () => {
    // Calling with the same provider twice must not duplicate its facts.
    const once = buildFactQueue(["Econet"]);
    const twice = buildFactQueue(["Econet", "Econet"]);
    expect(twice).toEqual(once);
  });

  it("combines facts from multiple different selections", () => {
    const queue = buildFactQueue(["Econet", "CBZ Bank"]);
    expect(queue).toContain("CBZ Bank traces back to 1980 and is one of Zimbabwe's largest financial institutions.");
    expect(queue.some((f) => f.startsWith("Econet launched"))).toBe(true);
  });
});
