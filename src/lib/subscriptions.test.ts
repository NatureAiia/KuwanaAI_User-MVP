import { beforeEach, describe, expect, it, vi } from "vitest";

const planUpsert = vi.fn();
const subscriptionFindUnique = vi.fn();
const subscriptionUpsert = vi.fn();
const subscriptionUpdate = vi.fn();
const subscriptionFindMany = vi.fn();
const userFindMany = vi.fn();
const userFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    plan: { upsert: planUpsert },
    subscription: {
      findUnique: subscriptionFindUnique,
      upsert: subscriptionUpsert,
      update: subscriptionUpdate,
      findMany: subscriptionFindMany,
    },
    user: { findMany: userFindMany, findUnique: userFindUnique },
  },
}));

const { ensurePlan, getOrCreateSubscription, ensureAllSubscriptions, hasFeature } = await import("@/lib/subscriptions");

function plan(overrides: Partial<{ id: string; billingPeriodMonths: number; features: string[] }> = {}) {
  return {
    id: "plan-1",
    key: "consumer_free",
    role: "consumer",
    name: "Free",
    priceCents: 0,
    currency: "USD",
    billingPeriodMonths: 1,
    features: [] as string[],
    isActive: true,
    ...overrides,
  };
}

beforeEach(() => {
  planUpsert.mockReset();
  subscriptionFindUnique.mockReset();
  subscriptionUpsert.mockReset();
  subscriptionUpdate.mockReset();
  subscriptionFindMany.mockReset();
  userFindMany.mockReset();
  userFindUnique.mockReset();
});

describe("ensurePlan", () => {
  it("upserts the canonical free plan by key for the given role", async () => {
    planUpsert.mockResolvedValue(plan());
    await ensurePlan("consumer");

    expect(planUpsert).toHaveBeenCalledWith({
      where: { key: "consumer_free" },
      update: {},
      create: { key: "consumer_free", role: "consumer", name: "Free", priceCents: 0, currency: "USD", features: [] },
    });
  });
});

describe("getOrCreateSubscription", () => {
  it("creates a subscription on the role's free plan when none exists", async () => {
    subscriptionFindUnique.mockResolvedValue(null);
    planUpsert.mockResolvedValue(plan());
    subscriptionUpsert.mockResolvedValue({ id: "sub-1", userId: "user-1", planId: "plan-1", plan: plan() });

    const result = await getOrCreateSubscription("user-1", "consumer");

    expect(subscriptionUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({ userId: "user-1", planId: "plan-1" }),
      }),
    );
    expect(result.planId).toBe("plan-1");
  });

  it("returns the existing subscription unchanged when its period isn't due yet", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const existing = { id: "sub-1", userId: "user-1", currentPeriodEnd: future, plan: plan() };
    subscriptionFindUnique.mockResolvedValue(existing);

    const result = await getOrCreateSubscription("user-1", "consumer");

    expect(subscriptionUpdate).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it("rolls the period forward by exactly one billing cycle once it's elapsed", async () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const existing = { id: "sub-1", userId: "user-1", currentPeriodEnd: past, plan: plan({ billingPeriodMonths: 1 }) };
    subscriptionFindUnique.mockResolvedValue(existing);
    subscriptionUpdate.mockResolvedValue({ ...existing, currentPeriodStart: past, currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z") });

    await getOrCreateSubscription("user-1", "consumer");

    expect(subscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: {
        currentPeriodStart: past,
        currentPeriodEnd: new Date("2026-02-01T00:00:00.000Z"),
      },
      include: { plan: true },
    });
  });
});

describe("ensureAllSubscriptions", () => {
  it("reports zero created/rolled when everything is already current", async () => {
    planUpsert.mockResolvedValue(plan());
    userFindMany.mockResolvedValue([]);
    subscriptionFindMany.mockResolvedValue([]);

    const result = await ensureAllSubscriptions();

    expect(result).toEqual({ created: 0, rolled: 0 });
  });

  it("counts backfilled and rolled-over subscriptions", async () => {
    planUpsert.mockResolvedValue(plan());
    userFindMany.mockResolvedValue([{ id: "user-2", role: "corporate" }]);
    subscriptionFindUnique.mockResolvedValue(null);
    subscriptionUpsert.mockResolvedValue({ id: "sub-2", userId: "user-2", planId: "plan-1", plan: plan() });
    const due = { id: "sub-3", userId: "user-3", currentPeriodEnd: new Date("2026-01-01"), plan: plan() };
    subscriptionFindMany.mockResolvedValue([due]);
    subscriptionUpdate.mockResolvedValue(due);

    const result = await ensureAllSubscriptions();

    expect(result).toEqual({ created: 1, rolled: 1 });
  });
});

describe("hasFeature", () => {
  it("allows access via a manual allowedFeatures override, regardless of plan", async () => {
    userFindUnique.mockResolvedValue({ role: "consumer", allowedFeatures: ["beta_x"] });

    expect(await hasFeature("user-1", "beta_x")).toBe(true);
    expect(subscriptionFindUnique).not.toHaveBeenCalled();
  });

  it("never gates provider/admin roles", async () => {
    userFindUnique.mockResolvedValue({ role: "admin", allowedFeatures: [] });

    expect(await hasFeature("user-1", "anything")).toBe(true);
  });

  it("allows access when the plan's features list is empty (full access)", async () => {
    userFindUnique.mockResolvedValue({ role: "consumer", allowedFeatures: [] });
    const future = new Date(Date.now() + 86_400_000);
    subscriptionFindUnique.mockResolvedValue({ id: "sub-1", currentPeriodEnd: future, plan: plan({ features: [] }) });

    expect(await hasFeature("user-1", "priority_support")).toBe(true);
  });

  it("denies a feature not listed in a restricted plan", async () => {
    userFindUnique.mockResolvedValue({ role: "consumer", allowedFeatures: [] });
    const future = new Date(Date.now() + 86_400_000);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      currentPeriodEnd: future,
      plan: plan({ features: ["other_feature"] }),
    });

    expect(await hasFeature("user-1", "priority_support")).toBe(false);
  });

  it("allows a feature explicitly listed in a restricted plan", async () => {
    userFindUnique.mockResolvedValue({ role: "consumer", allowedFeatures: [] });
    const future = new Date(Date.now() + 86_400_000);
    subscriptionFindUnique.mockResolvedValue({
      id: "sub-1",
      currentPeriodEnd: future,
      plan: plan({ features: ["priority_support"] }),
    });

    expect(await hasFeature("user-1", "priority_support")).toBe(true);
  });
});
