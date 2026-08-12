import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { recommendationCache: { findUnique, upsert } },
}));

const { recommendationCacheKey, getCachedRecommendation, isValidRecommendation, setCachedRecommendation } =
  await import("@/lib/recommendationCache");

const cachedPayload = () => ({
  primary_option: { listing_name: "A", key_differentiator: "cheapest in the set" },
  alternative_options: [{ listing_name: "B", key_differentiator: "higher decision score" }],
  explanation: {
    summary: "A is the best fit.",
    key_tradeoffs: ["B costs more."],
    data_traceability_notes: "Based on seeded data; AI-assisted.",
  },
  suggested_action: "Confirm the price before buying.",
  confidence: 0.9,
});

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

  it("folds a (pre-normalized) context string into the key deterministically", () => {
    expect(recommendationCacheKey(["a", "b"], "constraints=x|y")).toBe("a,b::constraints=x|y");
  });

  it("distinguishes the same listings under different budget contexts", () => {
    expect(recommendationCacheKey(["a", "b"], "budget=low")).not.toBe(recommendationCacheKey(["a", "b"], "budget=high"));
  });

  it("keeps the plain key stable when no context is provided", () => {
    expect(recommendationCacheKey(["a", "b"])).toBe("a,b");
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
      payload: cachedPayload(),
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await getCachedRecommendation("k")).toBeNull();
  });

  it("returns the payload for a live row", async () => {
    const payload = cachedPayload();
    findUnique.mockResolvedValue({ cacheKey: "k", payload, expiresAt: new Date(Date.now() + 1000) });
    expect(await getCachedRecommendation("k")).toEqual(payload);
  });
});

describe("isValidRecommendation", () => {
  it("accepts a well-formed payload", () => {
    expect(isValidRecommendation(cachedPayload())).toBe(true);
  });

  it("rejects a legacy-shape payload (old schema)", () => {
    expect(isValidRecommendation({ recommended_listing_name: "A", explanation: "x", confidence: 0.5 })).toBe(false);
  });

  it("rejects null / partial payloads", () => {
    expect(isValidRecommendation(null)).toBe(false);
    expect(isValidRecommendation({ primary_option: { listing_name: "A" } })).toBe(false);
  });
});

describe("setCachedRecommendation", () => {
  it("upserts with a future expiry", async () => {
    const payload = cachedPayload();
    await setCachedRecommendation("k", payload);

    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({ cacheKey: "k" });
    expect(call.create.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
