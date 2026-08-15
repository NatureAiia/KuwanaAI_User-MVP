import { NextResponse } from "next/server";

/**
 * Fixed-window rate limiter, with a shared counter when one is available.
 *
 * Two backends:
 *
 *   REDIS_URL set   — INCR + EXPIRE against the shared store, so the limit
 *                     is enforced across every replica. This is the real
 *                     limit.
 *   otherwise       — a per-process Map. On a single Node server that is
 *                     still a hard limit; on a multi-instance deploy the
 *                     effective budget is `limit x instances` and a cold
 *                     start resets it. It blunts the single-client floods
 *                     this exists for, but it is not a distributed limit and
 *                     must not be described as one.
 *
 * FAILURE POLICY — deliberately the opposite of cache-handler.js. A Redis
 * error there degrades to a cache miss, because the database can still
 * answer. Here, degrading to "allow" would mean a store outage silently
 * removes every spend limit on the Claude routes. So a Redis failure falls
 * back to the in-process counter: still bounded, just per-replica. Never
 * unbounded.
 *
 * The window is fixed rather than sliding, which permits a burst of up to
 * 2x the limit across a window boundary. For a cost-control limit on a
 * handful of routes that is an acceptable simplification; a sliding window
 * would need a sorted set per key and several more round-trips.
 */

type Window = { count: number; resetAt: number };

const hits = new Map<string, Window>();

// Bound the map so a flood of unique keys (one per spoofed IP) cannot grow
// it without limit — that would turn the mitigation into its own memory DoS.
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number) {
  for (const [key, window] of hits) {
    if (window.resetAt <= now) hits.delete(key);
  }
}

export type RateLimitRule = {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
};

export function checkRateLimit(key: string, { limit, windowSeconds }: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (hits.size > MAX_TRACKED_KEYS) sweep(now);

  const existing = hits.get(key);
  if (!existing || existing.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Best-effort client identity for unauthenticated routes.
 *
 * `x-forwarded-for` is client-controllable in general, so this is only
 * trustworthy behind a proxy that overwrites it (Vercel does). Behind
 * nothing, an attacker can rotate the header and evade the limit — which is
 * precisely why authenticated routes key on the user id instead, and why
 * this is a cost-control measure rather than an access control.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const REDIS_KEY_PREFIX = "kuwana:rl:";

/** Lazily constructed; a null client means "no shared store, use memory". */
let redisClient: unknown = null;
let redisUnavailable = false;

type MinimalRedis = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

function getRedis(): MinimalRedis | null {
  if (redisUnavailable) return null;
  if (redisClient) return redisClient as MinimalRedis;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisUnavailable = true;
    return null;
  }

  try {
    // Required lazily so that without REDIS_URL this module never pulls
    // ioredis into the bundle — same reasoning as cache-handler.js.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require("ioredis");
    redisClient = new Redis(url, {
      // A limiter must never be why a request hangs. If the store is
      // unreachable, fail fast and fall through to the in-process counter.
      connectTimeout: 1_000,
      commandTimeout: 1_000,
      maxRetriesPerRequest: 1,
      // On, not off. With it off, any command issued before the asynchronous
      // connect finishes rejects with "Stream isn't writeable" — measured
      // against a real Redis. Those requests then take the in-process
      // fallback below, which is silent: the limiter reports success while
      // quietly being per-replica again, exactly for the cold-start window
      // when a scaling event has just added pods. `commandTimeout` still
      // bounds how long anything waits, so the queue cannot grow unbounded.
      enableOfflineQueue: true,
      lazyConnect: false,
    });
    (redisClient as { on(event: string, cb: (e: unknown) => void): void }).on("error", () => {
      // ioredis emits 'error' on every reconnect attempt; an unhandled one
      // would crash the process. Swallow it — getRedis's own try/catch and
      // the per-command catch below decide what happens to the request.
    });
    return redisClient as MinimalRedis;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

/**
 * Shared-store check. Falls back to the in-process counter on any error, so
 * the caller always gets an answer and the limit is never simply dropped.
 */
async function checkRateLimitShared(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) return checkRateLimit(key, rule);

  const redisKey = REDIS_KEY_PREFIX + key;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // First hit in this window sets the expiry; subsequent hits inherit
      // it, which is what makes the window fixed rather than rolling.
      await redis.expire(redisKey, rule.windowSeconds);
    }
    if (count > rule.limit) {
      const ttlMs = await redis.pttl(redisKey);
      const retryAfter = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : rule.windowSeconds;
      return { allowed: false, remaining: 0, retryAfter };
    }
    return { allowed: true, remaining: rule.limit - count, retryAfter: 0 };
  } catch {
    return checkRateLimit(key, rule);
  }
}

/**
 * Applies a rule and returns a ready-to-return 429 when the caller is over
 * it, or null to continue. Route handlers read as
 * `const limited = await enforceRateLimit(...); if (limited) return limited;`.
 */
export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<NextResponse | null> {
  const result = await checkRateLimitShared(key, rule);
  if (result.allowed) return null;

  const response = NextResponse.json(
    { error: "Too many requests — please slow down and try again shortly." },
    { status: 429 },
  );
  response.headers.set("Retry-After", String(result.retryAfter));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/**
 * Named budgets, so the cost of a route is visible next to its limit rather
 * than buried as a magic number at the call site.
 */
export const RATE_LIMITS = {
  /** Unauthenticated + calls Claude on every request. The most abusable surface in the app. */
  publicAi: { limit: 5, windowSeconds: 60 },
  /** Authenticated Claude calls (chat, recommendations). Bills per message. */
  authedAi: { limit: 20, windowSeconds: 60 },
  /** Unauthenticated public DB write (waitlist). */
  publicWrite: { limit: 5, windowSeconds: 60 },
  /** Authenticated writes that mint XP or rows. Generous enough for real use, tight enough to stop scripted farming. */
  authedWrite: { limit: 60, windowSeconds: 60 },
  /** Public read-only catalog endpoints. */
  publicRead: { limit: 120, windowSeconds: 60 },
  /** /api/bi/v1/* — keyed by ApiKey.id, not IP, so one BI tool's schedule can't starve another key's budget. */
  biApi: { limit: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/** Test-only: drops all recorded windows so cases cannot leak into each other. */
export function __resetRateLimits() {
  hits.clear();
}
