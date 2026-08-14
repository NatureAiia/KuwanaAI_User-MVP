import { beforeEach, describe, expect, it, vi } from "vitest";

const discountRuleFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { discountRule: { findMany: discountRuleFindMany } },
}));

const { computeEffectivePrice, getActiveDiscountsMap, getActiveDiscountsForProvider } = await import(
  "@/lib/discounts"
);

beforeEach(() => {
  discountRuleFindMany.mockReset();
});

describe("computeEffectivePrice", () => {
  it("applies a percentage discount and rounds to 2dp", () => {
    expect(computeEffectivePrice(100, 15)).toBe(85);
    expect(computeEffectivePrice(19.99, 10)).toBe(17.99);
  });

  it("returns the original price when percentOff is 0", () => {
    expect(computeEffectivePrice(50, 0)).toBe(50);
  });
});

describe("getActiveDiscountsForProvider", () => {
  it("queries active rules for the provider ordered by most recent", async () => {
    discountRuleFindMany.mockResolvedValueOnce([]);
    await getActiveDiscountsForProvider("provider-1", new Date("2026-01-01"));

    expect(discountRuleFindMany).toHaveBeenCalledWith({
      where: {
        providerId: "provider-1",
        startsAt: { lte: new Date("2026-01-01") },
        endsAt: { gte: new Date("2026-01-01") },
      },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getActiveDiscountsMap", () => {
  it("returns an empty map for no listings without querying", async () => {
    const result = await getActiveDiscountsMap([]);
    expect(result.size).toBe(0);
    expect(discountRuleFindMany).not.toHaveBeenCalled();
  });

  it("prefers a listing-scoped rule over a category-scoped rule for the same listing", async () => {
    discountRuleFindMany
      .mockResolvedValueOnce([{ id: "rule-listing", listingId: "listing-1", categoryId: null, percentOff: 20 }])
      .mockResolvedValueOnce([{ id: "rule-category", listingId: null, categoryId: "cat-1", percentOff: 5 }]);

    const result = await getActiveDiscountsMap([{ id: "listing-1", categoryId: "cat-1" }]);

    expect(result.get("listing-1")?.id).toBe("rule-listing");
  });

  it("falls back to a category-scoped rule when no listing-scoped rule applies", async () => {
    discountRuleFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "rule-category", listingId: null, categoryId: "cat-1", percentOff: 5 }]);

    const result = await getActiveDiscountsMap([{ id: "listing-1", categoryId: "cat-1" }]);

    expect(result.get("listing-1")?.id).toBe("rule-category");
  });

  it("leaves a listing out of the map when no rule applies to it", async () => {
    discountRuleFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getActiveDiscountsMap([{ id: "listing-1", categoryId: "cat-1" }]);

    expect(result.has("listing-1")).toBe(false);
  });

  it("keeps only the most recent rule when duplicates target the same scope key", async () => {
    discountRuleFindMany
      .mockResolvedValueOnce([
        { id: "rule-newer", listingId: "listing-1", categoryId: null, percentOff: 20 },
        { id: "rule-older", listingId: "listing-1", categoryId: null, percentOff: 10 },
      ])
      .mockResolvedValueOnce([]);

    const result = await getActiveDiscountsMap([{ id: "listing-1", categoryId: "cat-1" }]);

    expect(result.get("listing-1")?.id).toBe("rule-newer");
  });
});
