import { describe, expect, it } from "vitest";
import { BI_SCOPES, BI_SCOPE_LABELS, isBiScope } from "@/lib/bi/scopes";

describe("BI_SCOPES / BI_SCOPE_LABELS", () => {
  it("has exactly one label per scope, and no orphan labels", () => {
    expect(Object.keys(BI_SCOPE_LABELS).sort()).toEqual([...BI_SCOPES].sort());
  });

  it("every scope is read-only (no write:* scope in the vocabulary)", () => {
    for (const scope of BI_SCOPES) {
      expect(scope.startsWith("read:")).toBe(true);
    }
  });
});

describe("isBiScope", () => {
  it("accepts every value in BI_SCOPES", () => {
    for (const scope of BI_SCOPES) {
      expect(isBiScope(scope)).toBe(true);
    }
  });

  it("rejects an unknown scope string", () => {
    expect(isBiScope("read:everything")).toBe(false);
  });

  it("rejects a write-shaped scope that was never defined", () => {
    expect(isBiScope("write:market")).toBe(false);
  });
});
