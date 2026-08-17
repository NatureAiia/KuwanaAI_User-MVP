import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  sectorConfig: { findUnique: vi.fn(), findMany: vi.fn() },
  category: { findFirst: vi.fn(), findUnique: vi.fn() },
  listing: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  sectorFootprint: { findUnique: vi.fn(), findMany: vi.fn() },
  comparison: { findMany: vi.fn() },
  savedListing: { findMany: vi.fn(), groupBy: vi.fn() },
  listingPriceHistory: { findMany: vi.fn(), create: vi.fn() },
  pinnedListing: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  userEvent: { findMany: vi.fn() },
  provider: { findMany: vi.fn() },
  socialPriceMention: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const loadFittedWeightsMock = vi.fn();
vi.mock("@/lib/fittedWeights", () => ({ loadFittedWeights: loadFittedWeightsMock }));

const {
  getSectorCategories,
  getCategorySchema,
  getCategoryAttributeMedians,
  getFootprintPriceWeight,
  getTopListings,
  getRecentlyViewed,
  getRecentlyViewedDetailed,
  getAlsoCompared,
  getTrendingListings,
  getProviderListingStats,
  getMarketOverview,
  getComplianceActivity,
  getFavoriteProductSpecials,
  getPersonalizedSpecials,
  getClosestMatches,
  recordPriceChange,
  setListingPinned,
  getSocialMentionsForProvider,
  AdminWrite,
} = await import("@/lib/catalog");

function makeProvider(
  overrides: Partial<{ id: string; name: string; logoUrl: string | null; verified: boolean; websiteUrl: string | null }> = {},
) {
  return { id: "provider-1", name: "Econet", logoUrl: null, verified: true, websiteUrl: null, ...overrides };
}

function makeListingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "listing-1",
    name: "NightBundle 10GB",
    description: null,
    price: 3,
    currency: "USD",
    attributes: {},
    freshnessStatus: "fresh",
    lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
    sourceUrl: null,
    images: [],
    rating: null,
    reviewCount: 0,
    categoryId: "category-1",
    provider: makeProvider(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSectorCategories", () => {
  it("returns [] when the sector doesn't exist", async () => {
    prismaMock.sectorConfig.findUnique.mockResolvedValue(null);
    expect(await getSectorCategories("missing-sector")).toEqual([]);
  });

  it("maps a sector's categories and their attribute schemas", async () => {
    prismaMock.sectorConfig.findUnique.mockResolvedValue({
      categories: [
        {
          id: "cat-sc",
          slug: "data-bundles-sc",
          name: "Data bundles",
          attributeSchema: [
            { key: "speedMbps", label: "Speed", dataType: "number", unit: "Mbps", isComparable: true, sortOrder: 0 },
          ],
        },
      ],
    });

    const result = await getSectorCategories("telecom-sc");
    expect(result).toEqual([
      {
        id: "cat-sc",
        slug: "data-bundles-sc",
        name: "Data bundles",
        attributeSchema: [
          { key: "speedMbps", label: "Speed", dataType: "number", unit: "Mbps", isComparable: true, sortOrder: 0 },
        ],
      },
    ]);
  });
});

describe("getCategorySchema", () => {
  it("passes the category id through to prisma and returns its result", async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: "cat-schema", attributeSchema: [] });
    const result = await getCategorySchema("cat-schema");
    expect(prismaMock.category.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cat-schema" } }),
    );
    expect(result).toEqual({ id: "cat-schema", attributeSchema: [] });
  });
});

describe("getCategoryAttributeMedians", () => {
  it("returns {} below the minimum listing threshold", async () => {
    prismaMock.listing.findMany.mockResolvedValue([{ attributes: { speedMbps: 10 } }, { attributes: { speedMbps: 20 } }]);
    const result = await getCategoryAttributeMedians("cat-thin");
    expect(result).toEqual({});
  });

  it("computes per-attribute medians, ignoring non-numeric values", async () => {
    prismaMock.listing.findMany.mockResolvedValue([
      { attributes: { speedMbps: 10, name: "a" } },
      { attributes: { speedMbps: 20, name: "b" } },
      { attributes: { speedMbps: 30, name: "c" } },
    ]);
    const result = await getCategoryAttributeMedians("cat-median");
    expect(result).toEqual({ speedMbps: 20 });
  });

  it("averages the two middle values for an even-sized set", async () => {
    prismaMock.listing.findMany.mockResolvedValue([
      { attributes: { speedMbps: 10 } },
      { attributes: { speedMbps: 20 } },
      { attributes: { speedMbps: 30 } },
      { attributes: { speedMbps: 40 } },
    ]);
    const result = await getCategoryAttributeMedians("cat-median-even");
    expect(result).toEqual({ speedMbps: 25 });
  });
});

describe("getFootprintPriceWeight", () => {
  it("defaults to 0.5 when there's no footprint", async () => {
    prismaMock.sectorFootprint.findUnique.mockResolvedValue(null);
    expect(await getFootprintPriceWeight("user-1", "telecom")).toBe(0.5);
  });

  it("defaults to 0.5 when the footprint has no spend field", async () => {
    prismaMock.sectorFootprint.findUnique.mockResolvedValue({ data: { network: "Econet" } });
    expect(await getFootprintPriceWeight("user-1", "telecom")).toBe(0.5);
  });

  it("biases toward price-sensitivity for low spend", async () => {
    prismaMock.sectorFootprint.findUnique.mockResolvedValue({ data: { monthlySpend: "Under $10" } });
    expect(await getFootprintPriceWeight("user-1", "telecom")).toBe(0.7);
  });

  it("reads the highest number out of a range string", async () => {
    prismaMock.sectorFootprint.findUnique.mockResolvedValue({ data: { spend: "$10–$25" } });
    expect(await getFootprintPriceWeight("user-1", "telecom")).toBe(0.6);
  });

  it("matches the spend key case-insensitively", async () => {
    prismaMock.sectorFootprint.findUnique.mockResolvedValue({ data: { "Monthly Spend": "$25–$50" } });
    expect(await getFootprintPriceWeight("user-1", "telecom")).toBe(0.5);
  });

  it("falls through to the least price-sensitive weight above the top bracket", async () => {
    prismaMock.sectorFootprint.findUnique.mockResolvedValue({ data: { spend: "$100+" } });
    expect(await getFootprintPriceWeight("user-1", "telecom")).toBe(0.3);
  });
});

describe("getTopListings", () => {
  it("returns an empty result when the category doesn't exist", async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);
    const result = await getTopListings("telecom", "missing-category");
    expect(result).toEqual({ categoryName: "", listings: [] });
  });

  it("ranks by score and slices to the limit", async () => {
    prismaMock.category.findFirst.mockResolvedValue({
      id: "cat-top",
      slug: "data-bundles",
      name: "Data bundles",
      attributeSchema: [],
      listings: [
        makeListingRow({ id: "cheap", price: 1 }),
        makeListingRow({ id: "mid", price: 5 }),
        makeListingRow({ id: "expensive", price: 10 }),
      ],
    });
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([]);

    const result = await getTopListings("telecom", "data-bundles", 2);
    expect(result.categoryName).toBe("Data bundles");
    expect(result.listings).toHaveLength(2);
    // Cheapest priced listing should score highest with the default 50/50
    // price weight and no benefit attribute to blend against.
    expect(result.listings[0].id).toBe("cheap");
  });
});

describe("getRecentlyViewed", () => {
  it("returns [] when there are no pins or events", async () => {
    prismaMock.pinnedListing.findMany.mockResolvedValue([]);
    prismaMock.userEvent.findMany.mockResolvedValue([]);
    expect(await getRecentlyViewed("user-1")).toEqual([]);
  });

  it("puts pinned listings first, then recency order, without duplicates", async () => {
    prismaMock.pinnedListing.findMany.mockResolvedValue([
      { listingId: "pinned-1", pinnedAt: new Date("2026-08-01") },
    ]);
    prismaMock.userEvent.findMany.mockResolvedValue([
      { metadata: { listingId: "recent-1" }, createdAt: new Date("2026-08-03") },
      { metadata: { listingId: "pinned-1" }, createdAt: new Date("2026-08-02") },
      { metadata: { listingId: "recent-1" }, createdAt: new Date("2026-08-01") },
      { metadata: { listingId: "recent-2" }, createdAt: new Date("2026-07-30") },
    ]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({ id: "pinned-1" }),
      makeListingRow({ id: "recent-1" }),
      makeListingRow({ id: "recent-2" }),
    ]);

    const result = await getRecentlyViewed("user-1", 6);
    expect(result.map((r) => r.listing.id)).toEqual(["pinned-1", "recent-1", "recent-2"]);
    expect(result[0].pinned).toBe(true);
    expect(result[1].pinned).toBe(false);
  });

  it("caps unpinned results so the total never exceeds the limit", async () => {
    prismaMock.pinnedListing.findMany.mockResolvedValue([
      { listingId: "pinned-a", pinnedAt: new Date("2026-08-01") },
      { listingId: "pinned-b", pinnedAt: new Date("2026-08-01") },
    ]);
    prismaMock.userEvent.findMany.mockResolvedValue([
      { metadata: { listingId: "recent-a" }, createdAt: new Date("2026-08-03") },
      { metadata: { listingId: "recent-b" }, createdAt: new Date("2026-08-02") },
    ]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({ id: "pinned-a" }),
      makeListingRow({ id: "pinned-b" }),
      makeListingRow({ id: "recent-a" }),
      makeListingRow({ id: "recent-b" }),
    ]);

    const result = await getRecentlyViewed("user-2", 3);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.listing.id)).toEqual(["pinned-a", "pinned-b", "recent-a"]);
  });
});

describe("getRecentlyViewedDetailed", () => {
  it("returns [] when there are no pins or events", async () => {
    prismaMock.pinnedListing.findMany.mockResolvedValue([]);
    prismaMock.userEvent.findMany.mockResolvedValue([]);
    expect(await getRecentlyViewedDetailed("user-detailed-empty")).toEqual([]);
  });

  it("resolves each listing's category and sector alongside pin/recency order", async () => {
    prismaMock.pinnedListing.findMany.mockResolvedValue([
      { listingId: "detailed-pinned", pinnedAt: new Date("2026-08-01") },
    ]);
    prismaMock.userEvent.findMany.mockResolvedValue([
      { metadata: { listingId: "detailed-recent" }, createdAt: new Date("2026-08-03") },
    ]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "detailed-pinned",
        category: {
          id: "cat-detailed",
          slug: "data-bundles-detailed",
          name: "Data bundles",
          sector: { slug: "telecom-detailed", name: "Telecom" },
        },
      }),
      makeListingRow({
        id: "detailed-recent",
        category: {
          id: "cat-detailed",
          slug: "data-bundles-detailed",
          name: "Data bundles",
          sector: { slug: "telecom-detailed", name: "Telecom" },
        },
      }),
    ]);

    const result = await getRecentlyViewedDetailed("user-detailed", 10);
    expect(result.map((r) => r.listing.id)).toEqual(["detailed-pinned", "detailed-recent"]);
    expect(result[0].pinned).toBe(true);
    expect(result[0].category).toEqual({
      id: "cat-detailed",
      slug: "data-bundles-detailed",
      name: "Data bundles",
      sector: { slug: "telecom-detailed", name: "Telecom" },
    });
  });
});

describe("getAlsoCompared", () => {
  it("returns [] when there are no comparisons", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([]);
    expect(await getAlsoCompared("listing-solo")).toEqual([]);
  });

  it("tallies co-occurrence and ranks by frequency, excluding the listing itself", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([
      { listingIds: ["target-x", "other-a", "other-b"] },
      { listingIds: ["target-x", "other-a"] },
      { listingIds: ["target-x", "other-b"] },
      { listingIds: ["target-x", "other-b"] },
    ]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({ id: "other-a" }),
      makeListingRow({ id: "other-b" }),
    ]);

    const result = await getAlsoCompared("target-x", 4);
    expect(result.map((l) => l.id)).toEqual(["other-b", "other-a"]);
  });
});

describe("getTrendingListings", () => {
  it("returns [] when nothing was compared in the window", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([]);
    expect(await getTrendingListings("sector-empty")).toEqual([]);
  });

  it("ranks listings by comparison count within the window", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([
      { listingIds: ["trend-a", "trend-b"] },
      { listingIds: ["trend-a"] },
    ]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({ id: "trend-a" }),
      makeListingRow({ id: "trend-b" }),
    ]);

    const result = await getTrendingListings("sector-trending", 6, 7);
    expect(result).toEqual([
      { listing: expect.objectContaining({ id: "trend-a" }), comparisonCount: 2 },
      { listing: expect.objectContaining({ id: "trend-b" }), comparisonCount: 1 },
    ]);
  });
});

describe("getProviderListingStats", () => {
  it("returns an empty map for an empty id list without querying", async () => {
    const result = await getProviderListingStats([]);
    expect(result).toEqual({});
    expect(prismaMock.comparison.findMany).not.toHaveBeenCalled();
  });

  it("aggregates comparison appearances and saved counts per listing", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([
      { listingIds: ["l1", "l2"] },
      { listingIds: ["l1"] },
    ]);
    prismaMock.savedListing.groupBy.mockResolvedValue([{ listingId: "l2", _count: 3 }]);

    const result = await getProviderListingStats(["l1", "l2"]);
    expect(result).toEqual({
      l1: { comparisonAppearances: 2, savedCount: 0 },
      l2: { comparisonAppearances: 1, savedCount: 3 },
    });
  });
});

describe("getMarketOverview", () => {
  it("rolls up per-sector price/trust stats and ranks anomalies by swing size", async () => {
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "m1",
        price: 10,
        provider: makeProvider({ verified: true }),
        category: { name: "Data bundles", sector: { slug: "telecom", name: "Telecom" } },
      }),
      makeListingRow({
        id: "m2",
        price: 20,
        provider: makeProvider({ verified: false }),
        category: { name: "Data bundles", sector: { slug: "telecom", name: "Telecom" } },
      }),
    ]);
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([
      { listingId: "m1", price: 10, recordedAt: new Date("2026-08-01") },
      { listingId: "m1", price: 8, recordedAt: new Date("2026-07-01") },
    ]);

    const result = await getMarketOverview();
    expect(result.bySector).toEqual([
      {
        sectorSlug: "telecom",
        sectorName: "Telecom",
        listingCount: 2,
        avgPrice: 15,
        trendingDown: 0,
        trendingUp: 1,
        unverifiedCount: 1,
      },
    ]);
    expect(result.unverifiedListings).toHaveLength(1);
    expect(result.unverifiedListings[0].listing.id).toBe("m2");
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0].listing.id).toBe("m1");
  });
});

describe("getComplianceActivity", () => {
  it("maps rejected listings into the compliance trail shape", async () => {
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "rejected-1",
        rejectionReason: "Price doesn't match source",
        lastVerifiedAt: new Date("2026-08-05"),
        category: { name: "Savings accounts", sector: { name: "Banking" } },
      }),
    ]);

    const result = await getComplianceActivity();
    expect(result).toEqual([
      {
        listing: expect.objectContaining({ id: "rejected-1" }),
        sectorName: "Banking",
        categoryName: "Savings accounts",
        rejectionReason: "Price doesn't match source",
        rejectedAt: new Date("2026-08-05").toISOString(),
      },
    ]);
  });
});

describe("getPersonalizedSpecials", () => {
  it("returns [] when the user has no comparisons, saves, or footprints", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([]);
    prismaMock.savedListing.findMany.mockResolvedValue([]);
    prismaMock.sectorFootprint.findMany.mockResolvedValue([]);

    expect(await getPersonalizedSpecials("user-empty")).toEqual([]);
  });

  it("builds a candidate category from explicit comparisons and ranks its listings", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([
      {
        category: { id: "cat-ps", slug: "ps-data-bundles", sector: { slug: "telecom-ps" } },
      },
    ]);
    prismaMock.savedListing.findMany.mockResolvedValue([]);
    prismaMock.sectorFootprint.findMany.mockResolvedValue([]);
    prismaMock.sectorFootprint.findUnique.mockResolvedValue(null);
    prismaMock.category.findFirst.mockResolvedValue({
      id: "cat-ps",
      slug: "ps-data-bundles",
      name: "Data bundles",
      attributeSchema: [],
      listings: [makeListingRow({ id: "ps-1" })],
    });
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([]);

    const result = await getPersonalizedSpecials("user-with-comparisons");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sectorSlug: "telecom-ps", categorySlug: "ps-data-bundles" });
    expect(result[0].listings[0].id).toBe("ps-1");
  });

  it("falls back to a footprint sector's first category when there's no explicit engagement", async () => {
    prismaMock.comparison.findMany.mockResolvedValue([]);
    prismaMock.savedListing.findMany.mockResolvedValue([]);
    prismaMock.sectorFootprint.findMany.mockResolvedValue([{ sector: "banking-fallback" }]);
    prismaMock.sectorFootprint.findUnique.mockResolvedValue(null);
    prismaMock.sectorConfig.findUnique.mockResolvedValue({
      categories: [
        {
          id: "cat-fallback",
          slug: "savings-fallback",
          name: "Savings accounts",
          attributeSchema: [],
        },
      ],
    });
    prismaMock.category.findFirst.mockResolvedValue({
      id: "cat-fallback",
      slug: "savings-fallback",
      name: "Savings accounts",
      attributeSchema: [],
      listings: [makeListingRow({ id: "fallback-1" })],
    });
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([]);

    const result = await getPersonalizedSpecials("user-footprint-fallback");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sectorSlug: "banking-fallback", categorySlug: "savings-fallback" });
  });
});

describe("getFavoriteProductSpecials", () => {
  beforeEach(() => {
    loadFittedWeightsMock.mockReturnValue(null);
  });

  it("returns [] when there's no footprint provider signal and no footprint categories", async () => {
    prismaMock.sectorFootprint.findMany.mockResolvedValue([]);
    prismaMock.savedListing.findMany.mockResolvedValue([]);
    prismaMock.sectorConfig.findMany.mockResolvedValue([]);

    expect(await getFavoriteProductSpecials("user-none")).toEqual([]);
  });

  it("extracts provider names from footprint fields matching provider/network/bank/insurer", async () => {
    prismaMock.sectorFootprint.findMany.mockResolvedValue([
      { sector: "telecom", data: { network: "Econet, NetOne" } },
    ]);
    prismaMock.savedListing.findMany.mockResolvedValue([]);
    prismaMock.sectorConfig.findMany.mockResolvedValue([]);
    prismaMock.provider.findMany.mockResolvedValue([{ id: "prov-econet", name: "Econet" }]);
    prismaMock.comparison.findMany.mockResolvedValue([]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "fav-1",
        providerId: "prov-econet",
        provider: makeProvider({ id: "prov-econet", verified: true }),
        category: {
          id: "cat-fav",
          slug: "data-bundles",
          name: "Data bundles",
          sector: { slug: "telecom", name: "Telecom" },
          attributeSchema: [],
        },
      }),
    ]);
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([]);

    const result = await getFavoriteProductSpecials("user-provider-match");
    expect(prismaMock.provider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([{ name: { in: expect.arrayContaining(["Econet", "NetOne"]) } }]),
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].listings[0].id).toBe("fav-1");
  });

  it("tags a listing trending down 5%+ with a price-drop reason", async () => {
    prismaMock.sectorFootprint.findMany.mockResolvedValue([]);
    prismaMock.savedListing.findMany.mockResolvedValue([{ listing: { providerId: "prov-drop" } }]);
    prismaMock.sectorConfig.findMany.mockResolvedValue([]);
    prismaMock.provider.findMany.mockResolvedValue([{ id: "prov-drop", name: "Econet" }]);
    prismaMock.comparison.findMany.mockResolvedValue([]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "drop-1",
        providerId: "prov-drop",
        provider: makeProvider({ id: "prov-drop", verified: false }),
        category: {
          id: "cat-drop",
          slug: "data-bundles",
          name: "Data bundles",
          sector: { slug: "telecom", name: "Telecom" },
          attributeSchema: [],
        },
      }),
    ]);
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([
      { listingId: "drop-1", price: 10, recordedAt: new Date("2026-07-01") },
      { listingId: "drop-1", price: 8, recordedAt: new Date("2026-08-01") },
    ]);

    const result = await getFavoriteProductSpecials("user-price-drop");
    expect(result[0].listings[0].reason).toContain("Price dropped");
  });

  it("uses the fitted-weight formula once its in-sample accuracy clears the floor", async () => {
    loadFittedWeightsMock.mockReturnValue({
      weights: {
        "data-bundles": {
          value_score: 0,
          special_bonus: 0,
          freshness_bonus: 0,
          trust_bonus: 0,
          trend_feature: 0,
          _intercept: 42,
          _accuracy: 0.9,
        },
      },
      mtimeMs: 1,
    });
    prismaMock.sectorFootprint.findMany.mockResolvedValue([]);
    prismaMock.savedListing.findMany.mockResolvedValue([{ listing: { providerId: "prov-fit" } }]);
    prismaMock.sectorConfig.findMany.mockResolvedValue([]);
    prismaMock.provider.findMany.mockResolvedValue([{ id: "prov-fit", name: "Econet" }]);
    prismaMock.comparison.findMany.mockResolvedValue([]);
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "fit-1",
        providerId: "prov-fit",
        provider: makeProvider({ id: "prov-fit" }),
        category: {
          id: "cat-fit",
          slug: "data-bundles",
          name: "Data bundles",
          sector: { slug: "telecom", name: "Telecom" },
          attributeSchema: [],
        },
      }),
    ]);
    prismaMock.listingPriceHistory.findMany.mockResolvedValue([]);

    const result = await getFavoriteProductSpecials("user-fitted");
    // Every coefficient is 0 except the intercept, so the fitted score is
    // exactly the intercept (before the 0-100 clamp).
    expect(result[0].listings[0].score).toBe(42);
  });
});

describe("getClosestMatches", () => {
  it("returns [] when the listing doesn't exist", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(null);
    expect(await getClosestMatches("missing-listing")).toEqual([]);
  });

  it("finds substitutes from sibling listings in the same category", async () => {
    prismaMock.listing.findUnique.mockResolvedValue(
      makeListingRow({
        id: "target-1",
        categoryId: "cat-similar",
        attributes: { speedMbps: 10 },
        category: { attributeSchema: [{ key: "speedMbps", label: "Speed", dataType: "number", unit: "Mbps", isComparable: true, sortOrder: 0 }] },
      }),
    );
    prismaMock.listing.findMany.mockResolvedValue([
      makeListingRow({
        id: "sibling-1",
        provider: makeProvider({ id: "provider-2" }),
        attributes: { speedMbps: 10 },
      }),
    ]);

    const result = await getClosestMatches("target-1", 3);
    expect(result.map((l) => l.id)).toEqual(["sibling-1"]);
  });
});

describe("simple passthroughs", () => {
  it("recordPriceChange snapshots the previous price", async () => {
    await recordPriceChange("listing-9", 12.5);
    expect(prismaMock.listingPriceHistory.create).toHaveBeenCalledWith({
      data: { listingId: "listing-9", price: 12.5 },
    });
  });

  it("setListingPinned upserts on pin", async () => {
    await setListingPinned("user-1", "listing-9", true);
    expect(prismaMock.pinnedListing.upsert).toHaveBeenCalledWith({
      where: { userId_listingId: { userId: "user-1", listingId: "listing-9" } },
      create: { userId: "user-1", listingId: "listing-9" },
      update: {},
    });
  });

  it("setListingPinned deletes on unpin", async () => {
    await setListingPinned("user-1", "listing-9", false);
    expect(prismaMock.pinnedListing.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", listingId: "listing-9" },
    });
  });

  it("getSocialMentionsForProvider queries by matched provider name", async () => {
    prismaMock.socialPriceMention.findMany.mockResolvedValue([{ id: "mention-1" }]);
    const result = await getSocialMentionsForProvider("Econet", 10);
    expect(prismaMock.socialPriceMention.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matchedProvider: "Econet" }, take: 10 }),
    );
    expect(result).toEqual([{ id: "mention-1" }]);
  });

  it("AdminWrite.publishListing sets status to published", async () => {
    await AdminWrite.publishListing("listing-9");
    expect(prismaMock.listing.update).toHaveBeenCalledWith({
      where: { id: "listing-9" },
      data: { status: "published" },
    });
  });

  it("AdminWrite.rejectListing sets status to rejected", async () => {
    await AdminWrite.rejectListing("listing-9");
    expect(prismaMock.listing.update).toHaveBeenCalledWith({
      where: { id: "listing-9" },
      data: { status: "rejected" },
    });
  });
});
