import { describe, expect, it } from "vitest";
import { computeTraditionalComparison, type TraditionalListingInput } from "@/lib/traditionalCompare";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

function listing(overrides: Partial<TraditionalListingInput> & { id: string; price: number }): TraditionalListingInput {
  return {
    name: overrides.id,
    provider: "Provider",
    providerVerified: true,
    currency: "USD",
    attributes: {},
    freshnessStatus: "fresh",
    trendPercent: null,
    ...overrides,
  };
}

describe("computeTraditionalComparison", () => {
  it("returns no winner for an empty listing set", () => {
    const result = computeTraditionalComparison({
      categoryName: "Savings accounts",
      categorySlug: "savings-accounts",
      attributeSchema: [],
      listings: [],
    });
    expect(result.winner).toBeNull();
    expect(result.runnerUps).toEqual([]);
  });

  it("scores a lower monthly_fee as better for savings-accounts (regression: engine used to score higher fees as better)", () => {
    const listings = [
      listing({ id: "low_fee", price: 2, attributes: { monthly_fee: 0, interest_rate: 1 } }),
      listing({ id: "high_fee", price: 2, attributes: { monthly_fee: 5, interest_rate: 1 } }),
    ];
    const result = computeTraditionalComparison({
      categoryName: "Savings accounts",
      categorySlug: "savings-accounts",
      attributeSchema: [],
      listings,
    });
    expect(result.winner?.name).toBe("low_fee");
  });

  it("scores a lower transaction_fee as better for current-accounts (regression: same direction bug)", () => {
    const listings = [
      listing({ id: "low_fee", price: 3, attributes: { transaction_fee: 0.1, branch_count: 20 } }),
      listing({ id: "high_fee", price: 3, attributes: { transaction_fee: 0.5, branch_count: 20 } }),
    ];
    const result = computeTraditionalComparison({
      categoryName: "Current accounts",
      categorySlug: "current-accounts",
      attributeSchema: [],
      listings,
    });
    expect(result.winner?.name).toBe("low_fee");
  });

  it("still scores a higher interest_rate as better (a genuine higher-is-better attribute)", () => {
    const listings = [
      listing({ id: "low_rate", price: 2, attributes: { monthly_fee: 1, interest_rate: 0.5 } }),
      listing({ id: "high_rate", price: 2, attributes: { monthly_fee: 1, interest_rate: 3 } }),
    ];
    const result = computeTraditionalComparison({
      categoryName: "Savings accounts",
      categorySlug: "savings-accounts",
      attributeSchema: [],
      listings,
    });
    expect(result.winner?.name).toBe("high_rate");
  });

  it("falls back to the 50/50 price+benefit blend, correctly inverted, for a category with no weight entry", () => {
    const schema: AttributeSchemaFieldDTO[] = [
      { key: "wait_time", label: "Wait time", dataType: "number", unit: "days", isComparable: true, sortOrder: 0 },
    ];
    const listings = [
      listing({ id: "short_wait", price: 10, attributes: { wait_time: 1 } }),
      listing({ id: "long_wait", price: 10, attributes: { wait_time: 10 } }),
    ];
    const result = computeTraditionalComparison({
      categoryName: "Some other category",
      categorySlug: "unweighted-category",
      attributeSchema: schema,
      listings,
    });
    expect(result.winner?.name).toBe("short_wait");
  });

  it("ranks runner-ups below the winner, most-to-least, capped at two", () => {
    const listings = [
      listing({ id: "a", price: 1, attributes: { monthly_fee: 0, interest_rate: 1 } }),
      listing({ id: "b", price: 2, attributes: { monthly_fee: 0, interest_rate: 1 } }),
      listing({ id: "c", price: 3, attributes: { monthly_fee: 0, interest_rate: 1 } }),
      listing({ id: "d", price: 4, attributes: { monthly_fee: 0, interest_rate: 1 } }),
    ];
    const result = computeTraditionalComparison({
      categoryName: "Savings accounts",
      categorySlug: "savings-accounts",
      attributeSchema: [],
      listings,
    });
    expect(result.winner?.name).toBe("a");
    expect(result.runnerUps).toHaveLength(2);
    expect(result.runnerUps[0].name).toBe("b");
    expect(result.runnerUps[1].name).toBe("c");
  });

  it("penalizes an unverified provider relative to an otherwise-identical verified one", () => {
    const listings = [
      listing({ id: "verified", price: 2, providerVerified: true, attributes: { monthly_fee: 0, interest_rate: 1 } }),
      listing({ id: "unverified", price: 2, providerVerified: false, attributes: { monthly_fee: 0, interest_rate: 1 } }),
    ];
    const result = computeTraditionalComparison({
      categoryName: "Savings accounts",
      categorySlug: "savings-accounts",
      attributeSchema: [],
      listings,
    });
    expect(result.winner?.name).toBe("verified");
  });
});
