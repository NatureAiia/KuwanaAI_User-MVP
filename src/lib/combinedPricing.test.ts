import { beforeEach, describe, expect, it, vi } from "vitest";

const getSectorPricingSummary = vi.fn();
const getActiveDiscountsMap = vi.fn();
const getLatestEconomicDrivers = vi.fn();

vi.mock("@/lib/pricingIntelligence", () => ({ getSectorPricingSummary }));
vi.mock("@/lib/discounts", () => ({
  getActiveDiscountsMap,
  computeEffectivePrice: (price: number, percentOff: number) =>
    Math.round(price * (1 - percentOff / 100) * 100) / 100,
}));
vi.mock("@/lib/economicDrivers", () => ({ getLatestEconomicDrivers }));

const { getCombinedPricingView } = await import("@/lib/combinedPricing");

function outlier(overrides: Record<string, unknown> = {}) {
  return {
    listingId: "listing-1",
    listingName: "Test listing",
    price: 100,
    currency: "USD",
    providerName: "Provider",
    categoryId: "cat-1",
    categoryName: "Category",
    sectorSlug: "telecom",
    sectorName: "Telecom",
    zScore: 2.5,
    belowPeerMedian: false,
    ...overrides,
  };
}

beforeEach(() => {
  getSectorPricingSummary.mockReset();
  getActiveDiscountsMap.mockReset();
  getLatestEconomicDrivers.mockReset();
  getLatestEconomicDrivers.mockResolvedValue([]);
});

describe("getCombinedPricingView", () => {
  it("leaves outliers without an active discount unannotated", async () => {
    getSectorPricingSummary.mockResolvedValueOnce({ bySector: [], outliers: [outlier()] });
    getActiveDiscountsMap.mockResolvedValueOnce(new Map());

    const result = await getCombinedPricingView();

    expect(result.outliers[0].discountPercentOff).toBeNull();
    expect(result.outliers[0].effectivePrice).toBeNull();
    // Existing outlier fields (z-score) are passed through untouched.
    expect(result.outliers[0].zScore).toBe(2.5);
  });

  it("attaches effective price when an active discount applies", async () => {
    getSectorPricingSummary.mockResolvedValueOnce({ bySector: [], outliers: [outlier({ price: 100 })] });
    getActiveDiscountsMap.mockResolvedValueOnce(new Map([["listing-1", { percentOff: 20 }]]));

    const result = await getCombinedPricingView();

    expect(result.outliers[0].discountPercentOff).toBe(20);
    expect(result.outliers[0].effectivePrice).toBe(80);
  });

  it("passes bySector through unchanged and includes economic drivers", async () => {
    const bySector = [{ sectorSlug: "telecom", sectorName: "Telecom", listingCount: 1, outlierCount: 0, belowPeerMedianCount: 0 }];
    getSectorPricingSummary.mockResolvedValueOnce({ bySector, outliers: [] });
    getActiveDiscountsMap.mockResolvedValueOnce(new Map());
    getLatestEconomicDrivers.mockResolvedValueOnce([
      { name: "USD_ZIG_RATE", region: "ZW", value: 30, previousValue: 28, period: new Date(), currencyCode: "ZIG", changePercent: 7.14 },
    ]);

    const result = await getCombinedPricingView("telecom");

    expect(result.bySector).toBe(bySector);
    expect(result.economicDrivers).toHaveLength(1);
    expect(getSectorPricingSummary).toHaveBeenCalledWith("telecom");
  });
});
