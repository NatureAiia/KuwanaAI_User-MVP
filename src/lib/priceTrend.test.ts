import { describe, expect, it } from "vitest";
import { computePriceForecast, computePriceTrend } from "@/lib/priceTrend";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

describe("computePriceTrend", () => {
  it("returns null with fewer than two price points", () => {
    expect(computePriceTrend([])).toBeNull();
    expect(computePriceTrend([{ price: 10, recordedAt: daysAgo(0) }])).toBeNull();
  });

  it("classifies a meaningful price drop as down", () => {
    const trend = computePriceTrend([
      { price: 20, recordedAt: daysAgo(30) },
      { price: 10, recordedAt: daysAgo(0) },
    ]);
    expect(trend?.direction).toBe("down");
    expect(trend?.changePercent).toBeLessThan(0);
  });

  it("classifies a meaningful price rise as up", () => {
    const trend = computePriceTrend([
      { price: 10, recordedAt: daysAgo(30) },
      { price: 20, recordedAt: daysAgo(0) },
    ]);
    expect(trend?.direction).toBe("up");
    expect(trend?.changePercent).toBeGreaterThan(0);
  });

  it("classifies a small movement under the flat threshold as flat", () => {
    const trend = computePriceTrend([
      { price: 100, recordedAt: daysAgo(30) },
      { price: 101, recordedAt: daysAgo(0) },
    ]);
    expect(trend?.direction).toBe("flat");
  });

  it("sorts out-of-order history by recordedAt before computing", () => {
    const trend = computePriceTrend([
      { price: 10, recordedAt: daysAgo(0) },
      { price: 20, recordedAt: daysAgo(30) },
    ]);
    expect(trend?.earliestPrice).toBe(20);
    expect(trend?.currentPrice).toBe(10);
    expect(trend?.direction).toBe("down");
  });
});

describe("computePriceForecast", () => {
  it("returns null with fewer than three points", () => {
    const trend = computePriceTrend([
      { price: 20, recordedAt: daysAgo(10) },
      { price: 10, recordedAt: daysAgo(0) },
    ]);
    expect(trend).not.toBeNull();
    expect(computePriceForecast(trend!)).toBeNull();
  });

  it("projects a continuing linear trend forward", () => {
    const trend = computePriceTrend([
      { price: 30, recordedAt: daysAgo(20) },
      { price: 20, recordedAt: daysAgo(10) },
      { price: 10, recordedAt: daysAgo(0) },
    ]);
    const forecast = computePriceForecast(trend!, 10);
    expect(forecast).not.toBeNull();
    // Losing 1/day for 20 days already; projecting 10 more days from a
    // steady decline should continue downward, not reverse.
    expect(forecast!.projectedPrice).toBeLessThan(trend!.currentPrice);
  });

  it("returns null when the projected price is within 1% of the current price (no meaningful forecast)", () => {
    const trend = computePriceTrend([
      { price: 100, recordedAt: daysAgo(20) },
      { price: 100, recordedAt: daysAgo(10) },
      { price: 100, recordedAt: daysAgo(0) },
    ]);
    expect(computePriceForecast(trend!)).toBeNull();
  });
});
