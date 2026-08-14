import { describe, expect, it, vi } from "vitest";

// computeOutlierScore is pure, but the module also imports prisma/the AI
// provider for its other exports — mocked here so importing the module
// doesn't try to open a real database connection or Anthropic client, same
// pattern as catalog.test.ts.
vi.mock("@/lib/prisma", () => ({ prisma: { listing: { findMany: vi.fn() } } }));
vi.mock("@/lib/ai/provider", () => ({ generateAiJson: vi.fn() }));

const { computeOutlierScore } = await import("@/lib/pricingIntelligence");
type PeerPriceStats = import("@/lib/pricingIntelligence").PeerPriceStats;

function stats(overrides: Partial<PeerPriceStats>): PeerPriceStats {
  return { medianPrice: 100, meanPrice: 100, stdDev: 10, sampleSize: 10, ...overrides };
}

describe("computeOutlierScore", () => {
  it("never flags an outlier below the minimum sample size, no matter how far off the price is", () => {
    const result = computeOutlierScore(1000, stats({ sampleSize: 4 }));
    expect(result.isOutlier).toBe(false);
    expect(result.zScore).toBe(0);
  });

  it("never flags an outlier when the peer set has zero spread", () => {
    const result = computeOutlierScore(1000, stats({ stdDev: 0 }));
    expect(result.isOutlier).toBe(false);
    expect(result.zScore).toBe(0);
  });

  it("flags a price more than 2 standard deviations above the mean", () => {
    const result = computeOutlierScore(130, stats({}));
    expect(result.zScore).toBeCloseTo(3, 1);
    expect(result.isOutlier).toBe(true);
  });

  it("flags a price more than 2 standard deviations below the mean", () => {
    const result = computeOutlierScore(70, stats({}));
    expect(result.zScore).toBeCloseTo(-3, 1);
    expect(result.isOutlier).toBe(true);
  });

  it("does not flag a price within 2 standard deviations of the mean", () => {
    const result = computeOutlierScore(115, stats({}));
    expect(result.zScore).toBeCloseTo(1.5, 1);
    expect(result.isOutlier).toBe(false);
  });

  it("does not flag a price exactly at the mean", () => {
    const result = computeOutlierScore(100, stats({}));
    expect(result.zScore).toBe(0);
    expect(result.isOutlier).toBe(false);
  });
});
