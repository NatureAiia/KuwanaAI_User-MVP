import { describe, expect, it } from "vitest";
import { matchProvider } from "@/lib/social-scan/matchProvider";

describe("matchProvider", () => {
  it("matches a known provider name embedded in free text", () => {
    expect(matchProvider("just switched to Econet and loving the data bundle")).toBe("Econet");
  });

  it("matches case-insensitively", () => {
    expect(matchProvider("CBZ BANK fees went up again")).toBe("CBZ Bank");
  });

  it("returns null when no known provider is mentioned", () => {
    expect(matchProvider("some random post about the weather")).toBeNull();
  });

  it("never matches an onboarding sentinel value like \"I don't bank\"", () => {
    expect(matchProvider("I don't bank with anyone these days")).toBeNull();
  });
});
