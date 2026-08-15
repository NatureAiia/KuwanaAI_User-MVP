import { beforeEach, describe, expect, it, vi } from "vitest";

const economicDriverFindMany = vi.fn();
const listingFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { economicDriver: { findMany: economicDriverFindMany }, listing: { findMany: listingFindMany } },
}));

const { nearestPriorReading, deflate, getDriverReadings, getRealPriceMovers, DEFAULT_FX_DRIVER_NAME } = await import(
  "@/lib/realPriceIndex"
);

function d(dateStr: string): Date {
  return new Date(dateStr);
}

beforeEach(() => {
  economicDriverFindMany.mockReset();
  listingFindMany.mockReset();
});

describe("nearestPriorReading", () => {
  it("returns the most recent reading at or before the given date", () => {
    const readings = [
      { value: 10, period: d("2026-01-01") },
      { value: 20, period: d("2026-02-01") },
      { value: 30, period: d("2026-03-01") },
    ];
    expect(nearestPriorReading(readings, d("2026-02-15"))?.value).toBe(20);
    expect(nearestPriorReading(readings, d("2026-03-01"))?.value).toBe(30);
  });

  it("falls back to the earliest reading when the date predates all of them", () => {
    const readings = [{ value: 10, period: d("2026-02-01") }];
    expect(nearestPriorReading(readings, d("2026-01-01"))?.value).toBe(10);
  });

  it("returns null when there are no readings at all", () => {
    expect(nearestPriorReading([], d("2026-01-01"))).toBeNull();
  });
});

describe("deflate", () => {
  it("divides each point by its nearest-prior driver reading", () => {
    const points = [
      { price: 100, recordedAt: d("2026-01-01") },
      { price: 200, recordedAt: d("2026-02-01") },
    ];
    const readings = [
      { value: 10, period: d("2026-01-01") },
      { value: 20, period: d("2026-02-01") },
    ];
    const result = deflate(points, readings);
    expect(result).toEqual([
      { price: 10, recordedAt: d("2026-01-01") },
      { price: 10, recordedAt: d("2026-02-01") },
    ]);
  });

  it("returns an empty array when there are no driver readings", () => {
    expect(deflate([{ price: 100, recordedAt: d("2026-01-01") }], [])).toEqual([]);
  });

  it("skips a point whose nearest reading is zero (would divide by zero)", () => {
    const points = [{ price: 100, recordedAt: d("2026-01-01") }];
    const readings = [{ value: 0, period: d("2026-01-01") }];
    expect(deflate(points, readings)).toEqual([]);
  });
});

describe("getDriverReadings", () => {
  it("queries the given driver name/region and coerces Decimal values to numbers", async () => {
    economicDriverFindMany.mockResolvedValueOnce([{ value: 30, period: d("2026-08-01") }]);
    const readings = await getDriverReadings("USD_ZIG_RATE", "ZW");
    expect(economicDriverFindMany).toHaveBeenCalledWith({
      where: { name: "USD_ZIG_RATE", region: "ZW" },
      orderBy: { period: "asc" },
    });
    expect(readings).toEqual([{ value: 30, period: d("2026-08-01") }]);
  });
});

describe("getRealPriceMovers", () => {
  function makeListing(overrides: Record<string, unknown> = {}) {
    return {
      id: "listing-1",
      name: "10kg mealie-meal",
      provider: { name: "OK Zimbabwe" },
      category: { name: "Staples", sector: { slug: "retail", name: "Retail" } },
      priceHistory: [],
      ...overrides,
    };
  }

  it("excludes listings with fewer than two price history points", async () => {
    listingFindMany.mockResolvedValueOnce([makeListing({ priceHistory: [{ price: 10, recordedAt: d("2026-01-01") }] })]);
    economicDriverFindMany.mockResolvedValueOnce([]);

    const movers = await getRealPriceMovers();
    expect(movers).toEqual([]);
  });

  it("returns real: null when there's no driver coverage at all", async () => {
    listingFindMany.mockResolvedValueOnce([
      makeListing({
        priceHistory: [
          { price: 10, recordedAt: d("2026-01-01") },
          { price: 20, recordedAt: d("2026-02-01") },
        ],
      }),
    ]);
    economicDriverFindMany.mockResolvedValueOnce([]);

    const [mover] = await getRealPriceMovers();
    expect(mover.nominal.changePercent).toBe(100);
    expect(mover.real).toBeNull();
  });

  it("shows a smaller real move than nominal when the driver moved in the same direction (FX-driven price rise)", async () => {
    listingFindMany.mockResolvedValueOnce([
      makeListing({
        priceHistory: [
          { price: 100, recordedAt: d("2026-01-01") },
          { price: 200, recordedAt: d("2026-02-01") },
        ],
      }),
    ]);
    // The FX rate itself doubled over the same window, so the real
    // (deflated) price is unchanged even though the nominal price doubled.
    economicDriverFindMany.mockResolvedValueOnce([
      { value: 10, period: d("2026-01-01") },
      { value: 20, period: d("2026-02-01") },
    ]);

    const [mover] = await getRealPriceMovers(undefined, DEFAULT_FX_DRIVER_NAME);
    expect(mover.nominal.changePercent).toBe(100);
    expect(mover.real?.changePercent).toBe(0);
  });

  it("sorts by the biggest real (deflated) move first, not the biggest nominal move", async () => {
    listingFindMany.mockResolvedValueOnce([
      makeListing({
        id: "small-real-move",
        priceHistory: [
          { price: 10, recordedAt: d("2026-01-01") },
          { price: 11, recordedAt: d("2026-02-01") },
        ],
      }),
      makeListing({
        id: "big-real-move",
        priceHistory: [
          { price: 100, recordedAt: d("2026-01-01") },
          { price: 200, recordedAt: d("2026-02-01") },
        ],
      }),
    ]);
    // Driver flat across the window, so real change equals nominal change for
    // both — this isolates the sort itself from the deflation logic.
    economicDriverFindMany.mockResolvedValueOnce([{ value: 10, period: d("2026-01-01") }]);

    const movers = await getRealPriceMovers();
    expect(movers[0].listingId).toBe("big-real-move");
    expect(movers[1].listingId).toBe("small-real-move");
  });
});
