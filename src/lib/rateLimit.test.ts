import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteMany = vi.fn();
const count = vi.fn();
const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { rateLimitHit: { deleteMany, count, create } },
}));

const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");

beforeEach(() => {
  deleteMany.mockReset();
  count.mockReset();
  create.mockReset();
});

describe("getClientIp", () => {
  it("reads the first address from a comma-separated x-forwarded-for", () => {
    const req = new Request("https://example.com", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to \"unknown\" when the header is missing", () => {
    const req = new Request("https://example.com");
    expect(getClientIp(req)).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  it("purges this key's expired hits before counting, scoped to just that key", async () => {
    count.mockResolvedValue(0);
    await checkRateLimit("waitlist:1.2.3.4", { windowMs: 60_000, max: 5 });

    expect(deleteMany).toHaveBeenCalledWith({
      where: { key: "waitlist:1.2.3.4", createdAt: { lt: expect.any(Date) } },
    });
  });

  it("allows the call and records a hit when under the limit", async () => {
    count.mockResolvedValue(3);
    const allowed = await checkRateLimit("waitlist:1.2.3.4", { windowMs: 60_000, max: 5 });

    expect(allowed).toBe(true);
    expect(create).toHaveBeenCalledWith({ data: { key: "waitlist:1.2.3.4" } });
  });

  it("rejects and does not record a hit when at the limit", async () => {
    count.mockResolvedValue(5);
    const allowed = await checkRateLimit("waitlist:1.2.3.4", { windowMs: 60_000, max: 5 });

    expect(allowed).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects when already over the limit", async () => {
    count.mockResolvedValue(9);
    const allowed = await checkRateLimit("waitlist:1.2.3.4", { windowMs: 60_000, max: 5 });

    expect(allowed).toBe(false);
  });
});
