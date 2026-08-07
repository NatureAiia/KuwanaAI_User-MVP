import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  enforceRateLimit,
  clientKey,
  RATE_LIMITS,
  __resetRateLimits,
} from "./rateLimit";

beforeEach(() => {
  __resetRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests up to the limit and blocks the one after", () => {
    const rule = { limit: 3, windowSeconds: 60 };
    expect(checkRateLimit("k", rule).allowed).toBe(true);
    expect(checkRateLimit("k", rule).allowed).toBe(true);
    expect(checkRateLimit("k", rule).allowed).toBe(true);
    expect(checkRateLimit("k", rule).allowed).toBe(false);
  });

  it("counts down `remaining` and never reports a negative", () => {
    const rule = { limit: 2, windowSeconds: 60 };
    expect(checkRateLimit("k", rule).remaining).toBe(1);
    expect(checkRateLimit("k", rule).remaining).toBe(0);
    expect(checkRateLimit("k", rule).remaining).toBe(0);
  });

  it("tracks each key independently, so one client cannot exhaust another's budget", () => {
    const rule = { limit: 1, windowSeconds: 60 };
    expect(checkRateLimit("user-a", rule).allowed).toBe(true);
    expect(checkRateLimit("user-a", rule).allowed).toBe(false);
    expect(checkRateLimit("user-b", rule).allowed).toBe(true);
  });

  it("starts a fresh window once the old one has elapsed", () => {
    const rule = { limit: 1, windowSeconds: 60 };
    const realNow = Date.now;
    let clock = 1_000_000;
    Date.now = () => clock;
    try {
      expect(checkRateLimit("k", rule).allowed).toBe(true);
      expect(checkRateLimit("k", rule).allowed).toBe(false);
      clock += 61_000;
      expect(checkRateLimit("k", rule).allowed).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it("reports a retryAfter of at least one second while blocked", () => {
    const rule = { limit: 1, windowSeconds: 30 };
    checkRateLimit("k", rule);
    const blocked = checkRateLimit("k", rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfter).toBeLessThanOrEqual(30);
  });
});

describe("enforceRateLimit", () => {
  // No REDIS_URL in the test env, so these exercise the in-process fallback
  // path — which is also the path a Redis outage degrades to in production.
  it("returns null while under the limit so the handler continues", async () => {
    expect(await enforceRateLimit("k", { limit: 2, windowSeconds: 60 })).toBeNull();
  });

  it("returns a 429 carrying Retry-After and no-store once over", async () => {
    const rule = { limit: 1, windowSeconds: 60 };
    await enforceRateLimit("k", rule);
    const blocked = await enforceRateLimit("k", rule);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(Number(blocked!.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(blocked!.headers.get("Cache-Control")).toBe("no-store");
  });

  it("never fails open — an unreachable store still enforces a bound", async () => {
    // The policy that separates this from the cache handler: a store outage
    // must not silently remove every spend limit on the Claude routes.
    const rule = { limit: 2, windowSeconds: 60 };
    expect(await enforceRateLimit("degraded", rule)).toBeNull();
    expect(await enforceRateLimit("degraded", rule)).toBeNull();
    expect(await enforceRateLimit("degraded", rule)).not.toBeNull();
  });
});

describe("clientKey", () => {
  it("uses the first hop of x-forwarded-for, not the whole chain", () => {
    const req = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.5, 70.41.3.18" },
    });
    expect(clientKey(req)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(clientKey(new Request("https://example.test", { headers: { "x-real-ip": "198.51.100.9" } }))).toBe(
      "198.51.100.9",
    );
    expect(clientKey(new Request("https://example.test"))).toBe("unknown");
  });
});

describe("RATE_LIMITS budgets", () => {
  it("keeps the unauthenticated AI route the tightest budget in the app", () => {
    // /api/need-intake is unauthenticated *and* bills a Claude call per
    // request. If any other budget is ever loosened below it, that ordering
    // has been broken.
    const perSecond = (r: { limit: number; windowSeconds: number }) => r.limit / r.windowSeconds;
    expect(perSecond(RATE_LIMITS.publicAi)).toBeLessThanOrEqual(perSecond(RATE_LIMITS.authedAi));
    expect(perSecond(RATE_LIMITS.publicAi)).toBeLessThanOrEqual(perSecond(RATE_LIMITS.publicRead));
  });
});
