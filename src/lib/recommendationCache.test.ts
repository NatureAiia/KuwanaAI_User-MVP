import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { recommendationCache: { findUnique, upsert } },
}));

const { recommendationCacheKey, getCachedRecommendation, setCachedRecommendation } = await import(
  "@/lib/recommendationCache"
);

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
});

describe("recommendationCacheKey", () => {
  it("is order-independent — the same set in a different order produces the same key", () => {
    expect(recommendationCacheKey(["b", "a"])).toBe(recommendationCacheKey(["a", "b"]));
  });

  it("distinguishes different sets", () => {
    expect(recommendationCacheKey(["a", "b"])).not.toBe(recommendationCacheKey(["a", "c"]));
  });
});

describe("getCachedRecommendation", () => {
  it("returns null when there's no cache row", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getCachedRecommendation("k")).toBeNull();
  });

  it("returns null for an expired row rather than stale data", async () => {
    findUnique.mockResolvedValue({
      cacheKey: "k",
      payload: { recommended_listing_name: "A", explanation: "x", confidence: 0.5 },
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await getCachedRecommendation("k")).toBeNull();
  });

  it("returns the payload for a live row", async () => {
    const payload = { recommended_listing_name: "A", explanation: "x", confidence: 0.5 };
    findUnique.mockResolvedValue({ cacheKey: "k", payload, expiresAt: new Date(Date.now() + 1000) });
    expect(await getCachedRecommendation("k")).toEqual(payload);
  });
});

describe("setCachedRecommendation", () => {
  it("upserts with a future expiry", async () => {
    const payload = { recommended_listing_name: "A", explanation: "x", confidence: 0.5 };
    await setCachedRecommendation("k", payload);

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ cacheKey: "k" });
    expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
