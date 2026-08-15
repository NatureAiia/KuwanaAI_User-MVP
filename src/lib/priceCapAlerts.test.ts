import { beforeEach, describe, expect, it, vi } from "vitest";

const priceCapRuleFindMany = vi.fn();
const listingFindMany = vi.fn();
const notificationUpsert = vi.fn();
const isNotificationEnabled = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    priceCapRule: { findMany: priceCapRuleFindMany },
    listing: { findMany: listingFindMany },
    notification: { upsert: notificationUpsert },
  },
}));
vi.mock("@/lib/notificationPreferences", () => ({ isNotificationEnabled }));

const { getPriceCapRulesWithBreaches, syncPriceCapNotifications } = await import("@/lib/priceCapAlerts");
type PriceCapRuleWithBreaches = Awaited<ReturnType<typeof getPriceCapRulesWithBreaches>>[number];

function makeRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    categoryId: "cat-1",
    capValue: 15,
    currency: "USD",
    enabled: true,
    createdByUserId: "user-1",
    createdAt: new Date("2026-01-01"),
    category: { name: "Fuel", sector: { name: "Transport" } },
    ...overrides,
  };
}

beforeEach(() => {
  priceCapRuleFindMany.mockReset();
  listingFindMany.mockReset();
  notificationUpsert.mockReset();
  isNotificationEnabled.mockReset();
});

describe("getPriceCapRulesWithBreaches", () => {
  it("returns [] without querying listings when there are no rules", async () => {
    priceCapRuleFindMany.mockResolvedValueOnce([]);
    const result = await getPriceCapRulesWithBreaches();
    expect(result).toEqual([]);
    expect(listingFindMany).not.toHaveBeenCalled();
  });

  it("queries listings scoped to the rule's own category, status, currency, and cap threshold", async () => {
    const rule = makeRule();
    priceCapRuleFindMany.mockResolvedValueOnce([rule]);
    listingFindMany.mockResolvedValueOnce([]);

    await getPriceCapRulesWithBreaches();

    expect(listingFindMany).toHaveBeenCalledWith({
      where: { categoryId: "cat-1", status: "published", currency: "USD", price: { gt: 15 } },
      include: { provider: { select: { name: true } } },
    });
  });

  it("maps breaching listings with their provider name and numeric price", async () => {
    priceCapRuleFindMany.mockResolvedValueOnce([makeRule()]);
    listingFindMany.mockResolvedValueOnce([
      { id: "listing-1", name: "Diesel 5L", price: 20, provider: { name: "Puma" } },
    ]);

    const [result] = await getPriceCapRulesWithBreaches();
    expect(result.categoryName).toBe("Fuel");
    expect(result.sectorName).toBe("Transport");
    expect(result.breaches).toEqual([{ listingId: "listing-1", listingName: "Diesel 5L", providerName: "Puma", price: 20 }]);
  });
});

describe("syncPriceCapNotifications", () => {
  function ruleWithBreaches(overrides: Record<string, unknown> = {}) {
    return {
      ...makeRule(),
      categoryName: "Fuel",
      sectorName: "Transport",
      breaches: [{ listingId: "l1", listingName: "Diesel 5L", providerName: "Puma", price: 20 }],
      ...overrides,
    } as unknown as PriceCapRuleWithBreaches;
  }

  it("skips a disabled rule even if it has breaches", async () => {
    await syncPriceCapNotifications([ruleWithBreaches({ enabled: false })]);
    expect(notificationUpsert).not.toHaveBeenCalled();
  });

  it("skips a rule with no breaches", async () => {
    await syncPriceCapNotifications([ruleWithBreaches({ breaches: [] })]);
    expect(notificationUpsert).not.toHaveBeenCalled();
  });

  it("skips upserting when the creator has disabled this notification type", async () => {
    isNotificationEnabled.mockResolvedValueOnce(false);
    await syncPriceCapNotifications([ruleWithBreaches()]);
    expect(notificationUpsert).not.toHaveBeenCalled();
  });

  it("upserts a summary notification naming the breach count and cap", async () => {
    isNotificationEnabled.mockResolvedValueOnce(true);
    await syncPriceCapNotifications([ruleWithBreaches()]);

    expect(notificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_priceCapRuleId_type: { userId: "user-1", priceCapRuleId: "rule-1", type: "price_cap_breached" } },
        create: expect.objectContaining({ message: expect.stringContaining("1 listing(s) in Fuel are priced above the USD 15 cap.") }),
      }),
    );
  });
});
