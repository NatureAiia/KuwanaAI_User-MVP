import { beforeEach, describe, expect, it, vi } from "vitest";

const marketBasketItemGroupBy = vi.fn();
const marketBasketItemFindMany = vi.fn();
const economicDriverFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    marketBasketItem: { groupBy: marketBasketItemGroupBy, findMany: marketBasketItemFindMany },
    economicDriver: { findMany: economicDriverFindMany },
  },
}));

const { getMarketBaskets, buildCompositeSeries, getBasketIndexTrend } = await import("@/lib/marketBasket");

function d(dateStr: string): Date {
  return new Date(dateStr);
}

beforeEach(() => {
  marketBasketItemGroupBy.mockReset();
  marketBasketItemFindMany.mockReset();
  economicDriverFindMany.mockReset();
});

describe("getMarketBaskets", () => {
  it("maps groupBy rows into basketName/componentCount, sorted alphabetically", async () => {
    marketBasketItemGroupBy.mockResolvedValueOnce([
      { basketName: "Fuel Basket", _count: { _all: 2 } },
      { basketName: "Consumer Price Basket", _count: { _all: 5 } },
    ]);

    const baskets = await getMarketBaskets();
    expect(baskets).toEqual([
      { basketName: "Consumer Price Basket", componentCount: 5 },
      { basketName: "Fuel Basket", componentCount: 2 },
    ]);
  });
});

describe("buildCompositeSeries", () => {
  it("only starts once every component has at least one recorded price", () => {
    const series = buildCompositeSeries([
      { weight: 1, history: [{ price: 10, recordedAt: d("2026-01-01") }] },
      { weight: 1, history: [{ price: 5, recordedAt: d("2026-01-15") }] },
    ]);
    // 2026-01-01 is dropped: the second component has no price yet at that point.
    expect(series).toEqual([{ price: 15, recordedAt: d("2026-01-15") }]);
  });

  it("forward-fills each component's most recent known price at every date", () => {
    const series = buildCompositeSeries([
      {
        weight: 1,
        history: [
          { price: 10, recordedAt: d("2026-01-01") },
          { price: 20, recordedAt: d("2026-03-01") },
        ],
      },
      { weight: 1, history: [{ price: 5, recordedAt: d("2026-01-01") }] },
    ]);
    // At 2026-03-01 the second component still contributes its last known
    // price (5), not zero or a missing value.
    expect(series).toEqual([
      { price: 15, recordedAt: d("2026-01-01") },
      { price: 25, recordedAt: d("2026-03-01") },
    ]);
  });

  it("applies each component's weight", () => {
    const series = buildCompositeSeries([
      { weight: 2, history: [{ price: 10, recordedAt: d("2026-01-01") }] },
      { weight: 0.5, history: [{ price: 4, recordedAt: d("2026-01-01") }] },
    ]);
    expect(series).toEqual([{ price: 22, recordedAt: d("2026-01-01") }]);
  });
});

describe("getBasketIndexTrend", () => {
  it("returns null when the basket has no components", async () => {
    marketBasketItemFindMany.mockResolvedValueOnce([]);
    expect(await getBasketIndexTrend("Missing Basket")).toBeNull();
  });

  it("computes a nominal trend from the merged composite series", async () => {
    marketBasketItemFindMany.mockResolvedValueOnce([
      {
        label: "10kg mealie-meal",
        weight: 1,
        listing: {
          name: "Roller Meal 10kg",
          priceHistory: [
            { price: 10, recordedAt: d("2026-01-01") },
            { price: 20, recordedAt: d("2026-02-01") },
          ],
        },
      },
    ]);
    economicDriverFindMany.mockResolvedValueOnce([]);

    const trend = await getBasketIndexTrend("Consumer Price Basket");
    expect(trend?.nominal?.changePercent).toBe(100);
    expect(trend?.real).toBeNull();
    expect(trend?.components).toEqual([{ label: "10kg mealie-meal", listingName: "Roller Meal 10kg" }]);
  });
});
