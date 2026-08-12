import { describe, expect, it } from "vitest";
import { computeDecisionScores } from "@/lib/scoring";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

function listing(overrides: Partial<ListingDTO> & { id: string; price: number }): ListingDTO {
  return {
    name: overrides.id,
    currency: "USD",
    attributes: {},
    freshnessStatus: "fresh",
    lastVerifiedAt: new Date().toISOString(),
    sourceUrl: null,
    images: [],
    description: null,
    rating: null,
    reviewCount: 0,
    provider: { id: "p1", name: "Provider", logoUrl: null, verified: true },
    ...overrides,
  };
}

describe("computeDecisionScores", () => {
  it("returns nothing for an empty listing set", () => {
    expect(computeDecisionScores([], [])).toEqual({});
  });

  it("scores the cheaper of two otherwise-identical listings higher on price alone", () => {
    const listings = [listing({ id: "cheap", price: 10 }), listing({ id: "pricey", price: 20 })];
    const scores = computeDecisionScores(listings, []);
    expect(scores.cheap.priceScore).toBeGreaterThan(scores.pricey.priceScore);
    expect(scores.cheap.total).toBeGreaterThan(scores.pricey.total);
    expect(scores.cheap.benefitScore).toBeNull();
  });

  it("blends in a comparable numeric benefit attribute when the schema declares one", () => {
    const schema: AttributeSchemaFieldDTO[] = [
      { key: "price", label: "Price", dataType: "number", unit: null, isComparable: true, sortOrder: 0 },
      { key: "data_gb", label: "Data", dataType: "number", unit: "GB", isComparable: true, sortOrder: 1 },
    ];
    const listings = [
      listing({ id: "a", price: 10, attributes: { data_gb: 1 } }),
      listing({ id: "b", price: 10, attributes: { data_gb: 10 } }),
    ];
    const scores = computeDecisionScores(listings, schema);
    // Same price -> priceScore ties; more data should push b's total higher via benefitScore.
    expect(scores.b.benefitScore).toBeGreaterThan(scores.a.benefitScore ?? 0);
    expect(scores.b.total).toBeGreaterThan(scores.a.total);
  });

  it("skips a lower-is-better fee field in favor of a genuine higher-is-better benefit", () => {
    const schema: AttributeSchemaFieldDTO[] = [
      { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD", isComparable: true, sortOrder: 0 },
      { key: "interest_rate", label: "Interest rate", dataType: "number", unit: "% p.a.", isComparable: true, sortOrder: 1 },
    ];
    const listings = [
      // Same price, but "high fee, high interest" vs "low fee, low interest" —
      // the interest rate (a genuine benefit) should win as the benefit field,
      // not the monthly fee (whose lower value is actually the better one).
      listing({ id: "high_fee_high_rate", price: 10, attributes: { monthly_fee: 5, interest_rate: 3 } }),
      listing({ id: "low_fee_low_rate", price: 10, attributes: { monthly_fee: 0, interest_rate: 0.5 } }),
    ];
    const scores = computeDecisionScores(listings, schema);
    expect(scores.high_fee_high_rate.benefitScore).toBeGreaterThan(scores.low_fee_low_rate.benefitScore ?? 0);
    expect(scores.high_fee_high_rate.total).toBeGreaterThan(scores.low_fee_low_rate.total);
  });

  it("falls back to a lower-is-better field, correctly inverted, when it's the only comparable one", () => {
    const schema: AttributeSchemaFieldDTO[] = [
      { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD", isComparable: true, sortOrder: 0 },
    ];
    const listings = [
      listing({ id: "low_fee", price: 10, attributes: { monthly_fee: 0 } }),
      listing({ id: "high_fee", price: 10, attributes: { monthly_fee: 5 } }),
    ];
    const scores = computeDecisionScores(listings, schema);
    expect(scores.low_fee.benefitScore).toBeGreaterThan(scores.high_fee.benefitScore ?? 0);
    expect(scores.low_fee.total).toBeGreaterThan(scores.high_fee.total);
  });

  it("applies a freshness penalty to stale/unverified listings relative to a fresh one", () => {
    const listings = [
      listing({ id: "fresh", price: 10, freshnessStatus: "fresh" }),
      listing({ id: "stale", price: 10, freshnessStatus: "stale" }),
      listing({ id: "unverified", price: 10, freshnessStatus: "unverified" }),
    ];
    const scores = computeDecisionScores(listings, []);
    expect(scores.fresh.freshnessAdjustment).toBe(0);
    expect(scores.stale.freshnessAdjustment).toBeLessThan(0);
    expect(scores.unverified.freshnessAdjustment).toBeLessThan(scores.stale.freshnessAdjustment);
    expect(scores.fresh.total).toBeGreaterThan(scores.stale.total);
    expect(scores.stale.total).toBeGreaterThan(scores.unverified.total);
  });

  it("applies a trust penalty for an unverified provider", () => {
    const listings = [
      listing({ id: "verified", price: 10, provider: { id: "p1", name: "A", logoUrl: null, verified: true } }),
      listing({ id: "unverified", price: 10, provider: { id: "p2", name: "B", logoUrl: null, verified: false } }),
    ];
    const scores = computeDecisionScores(listings, []);
    expect(scores.verified.trustAdjustment).toBe(0);
    expect(scores.unverified.trustAdjustment).toBeLessThan(0);
    expect(scores.verified.total).toBeGreaterThan(scores.unverified.total);
  });

  it("rewards a downward price trend and penalizes an upward one, capped at maxTrendAdjustment", () => {
    const listings = [listing({ id: "down", price: 10 }), listing({ id: "up", price: 10 })];
    const scores = computeDecisionScores(listings, [], {
      down: { direction: "down", changePercent: -50, periodDays: 30, currentPrice: 10, earliestPrice: 20, points: [] },
      up: { direction: "up", changePercent: 50, periodDays: 30, currentPrice: 10, earliestPrice: 5, points: [] },
    });
    expect(scores.down.trendAdjustment).toBeGreaterThan(0);
    expect(scores.up.trendAdjustment).toBeLessThan(0);
    expect(scores.down.trendAdjustment).toBeLessThanOrEqual(5);
    expect(scores.up.trendAdjustment).toBeGreaterThanOrEqual(-5);
  });

  it("always clamps the total score into [0, 100]", () => {
    const listings = [
      listing({ id: "worst", price: 10, freshnessStatus: "unverified", provider: { id: "p", name: "P", logoUrl: null, verified: false } }),
    ];
    const scores = computeDecisionScores(listings, [], {
      worst: { direction: "up", changePercent: 200, periodDays: 10, currentPrice: 10, earliestPrice: 3, points: [] },
    });
    expect(scores.worst.total).toBeGreaterThanOrEqual(0);
    expect(scores.worst.total).toBeLessThanOrEqual(100);
  });

  it("stamps every breakdown with the version that produced it", () => {
    const scores = computeDecisionScores([listing({ id: "a", price: 10 })], []);
    expect(scores.a.version).toBe("v1");
  });
});
