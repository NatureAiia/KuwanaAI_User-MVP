import { afterEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn().mockResolvedValue({});
vi.mock("@/lib/prisma", () => ({ prisma: { apiKey: { findUnique, update } } }));

const enforceRateLimit = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/rateLimit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rateLimit")>("@/lib/rateLimit");
  return { ...actual, enforceRateLimit };
});

const { requireApiKey, requireScope } = await import("@/lib/bi/auth");
const { hashApiKey } = await import("@/lib/bi/keys");

function requestWithAuth(header: string | null) {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("https://example.com/api/bi/v1/market-overview", { headers });
}

afterEach(() => {
  findUnique.mockReset();
  update.mockClear();
  enforceRateLimit.mockReset().mockResolvedValue(null);
});

describe("requireApiKey", () => {
  it("rejects a request with no Authorization header", async () => {
    const result = await requireApiKey(requestWithAuth(null));
    expect("response" in result && result.response.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header (not 'Bearer <key>')", async () => {
    const result = await requireApiKey(requestWithAuth("kuwana_bi_abc"));
    expect("response" in result && result.response.status).toBe(401);
  });

  it("looks up the key by its hash, never the plaintext", async () => {
    findUnique.mockResolvedValue({ id: "key1", scopes: ["read:market"], providerId: null, revokedAt: null });
    await requireApiKey(requestWithAuth("Bearer kuwana_bi_secret"));
    expect(findUnique).toHaveBeenCalledWith({ where: { hashedKey: hashApiKey("kuwana_bi_secret") } });
  });

  it("rejects an unknown key", async () => {
    findUnique.mockResolvedValue(null);
    const result = await requireApiKey(requestWithAuth("Bearer kuwana_bi_unknown"));
    expect("response" in result && result.response.status).toBe(401);
  });

  it("rejects a revoked key", async () => {
    findUnique.mockResolvedValue({ id: "key1", scopes: ["read:market"], providerId: null, revokedAt: new Date() });
    const result = await requireApiKey(requestWithAuth("Bearer kuwana_bi_secret"));
    expect("response" in result && result.response.status).toBe(401);
  });

  it("rate-limits by key id, not by IP", async () => {
    findUnique.mockResolvedValue({ id: "key1", scopes: ["read:market"], providerId: null, revokedAt: null });
    await requireApiKey(requestWithAuth("Bearer kuwana_bi_secret"));
    expect(enforceRateLimit).toHaveBeenCalledWith("bi:key1", expect.objectContaining({ limit: expect.any(Number) }));
  });

  it("returns the 429 response when the key is over its rate limit", async () => {
    findUnique.mockResolvedValue({ id: "key1", scopes: ["read:market"], providerId: null, revokedAt: null });
    const { NextResponse } = await import("next/server");
    enforceRateLimit.mockResolvedValue(NextResponse.json({ error: "slow down" }, { status: 429 }));

    const result = await requireApiKey(requestWithAuth("Bearer kuwana_bi_secret"));
    expect("response" in result && result.response.status).toBe(429);
  });

  it("accepts a valid, non-revoked key and returns it", async () => {
    findUnique.mockResolvedValue({ id: "key1", scopes: ["read:market"], providerId: "prov1", revokedAt: null });
    const result = await requireApiKey(requestWithAuth("Bearer kuwana_bi_secret"));
    expect("apiKey" in result && result.apiKey.id).toBe("key1");
  });

  it("never lets a failed lastUsedAt write reject or delay the response", async () => {
    findUnique.mockResolvedValue({ id: "key1", scopes: ["read:market"], providerId: null, revokedAt: null });
    update.mockRejectedValue(new Error("db down"));

    const result = await requireApiKey(requestWithAuth("Bearer kuwana_bi_secret"));
    expect("apiKey" in result).toBe(true);
  });
});

describe("requireScope", () => {
  const apiKey = { id: "key1", scopes: ["read:market"], providerId: null };

  it("returns null when the key has the required scope", () => {
    expect(requireScope(apiKey, "read:market")).toBeNull();
  });

  it("returns a 403 when the key is missing the required scope", () => {
    const result = requireScope(apiKey, "read:pricing");
    expect(result?.status).toBe(403);
  });
});
