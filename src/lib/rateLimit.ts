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
 * Number of proxies between the internet and this process that append to
 * `x-forwarded-for`. 1 covers the usual single ingress/CDN hop; raise it if
 * traffic passes through both a CDN and an ingress controller.
 *
 * Getting this wrong is safe in one direction and not the other. Too high and
 * everyone collapses onto one key (limits become global — noisy but not a
 * bypass). Too low and clients can inject their own hop, which *is* a bypass.
 */
function trustedProxyCount(): number {
  const configured = Number(process.env.TRUSTED_PROXY_COUNT);
  return Number.isInteger(configured) && configured >= 0 ? configured : 1;
}

/**
 * Best-effort client identity for unauthenticated routes.
 *
 * `x-forwarded-for` is a list appended to by each hop, so it is part attacker
 * input and part infrastructure fact. Everything the client sent arrives on
 * the LEFT; each proxy appends the address it actually saw on the RIGHT. Only
 * the rightmost entries — the ones our own infrastructure wrote — are trustworthy.
 *
 * This used to read `split(",")[0]`, the leftmost entry, which is the half a
 * client fully controls: sending `X-Forwarded-For: <random>` produced a fresh
 * rate-limit key per request and bypassed every IP-keyed limit in the app,
 * including the Paynow webhook limiter and the public AI routes. Now it counts
 * back from the right by the number of hops we actually run.
 *
 * Still not an access control — a determined attacker has many IPs. It is a
 * cost and flood control, which is why authenticated routes key on user id.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    // The hop our own edge observed: one in from the right per trusted proxy.
    const index = hops.length - trustedProxyCount();
    const candidate = hops[index >= 0 ? index : 0];
    if (candidate) return candidate;
  }
  // Set by the proxy itself rather than forwarded from the client, so it does
  // not carry the same list-position problem.
  return req.headers.get("x-real-ip") ?? "unknown";
}

const REDIS_KEY_PREFIX = "kuwana:rl:";

/** Lazily constructed; a null client means "no shared store, use memory". */
let redisClient: unknown = null;
let redisUnavailable = false;

type MinimalRedis = {
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
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
  /** Binary uploads (listing/advert images) — each call buffers up to MAX_IMAGE_BYTES in memory and costs real storage/bandwidth, so tighter than authedWrite. */
  mediaUpload: { limit: 10, windowSeconds: 60 },
  /**
   * Second, IP-keyed limit stacked on top of wallet top-up's per-user limit —
   * a per-account cap alone is fully bypassed by spreading calls across a
   * farm of accounts from one machine. Same IP-spoofability caveat as
   * clientKey() above: a cost/abuse-shape control, not an access control.
   */
  walletTopupIp: { limit: 20, windowSeconds: 60 },
  /**
   * Sending a signup verification code. Every call puts a real message in a
   * real inbox and costs the mail provider's per-message fee, so this is
   * tighter than any other authenticated write. Five is enough for a user who
   * mistypes their address, waits, and retries; it is not enough to use the
   * resend button as a mail bomb.
   */
  emailVerificationSend: { limit: 5, windowSeconds: 900 },
  /**
   * Submitting a code. MAX_ATTEMPTS already bounds guesses against any single
   * code; this bounds the rate across codes, so an attacker cannot cycle
   * request-guess-five-times-request-again at machine speed.
   */
  emailVerificationVerify: { limit: 10, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitRule>;

/* -------------------------------------------------------------------------- */
/* Concurrency slots                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A cap on *simultaneous* long-running requests per user, which a rate limit
 * cannot express: 20 chats/minute is a reasonable budget, and 20 chats open at
 * once from one account is not. Each one holds an upstream LLM stream open, so
 * the cost of the concurrent case is unbounded in a way the per-minute count
 * never reveals.
 *
 * FAILURE POLICY — deliberately the opposite of enforceRateLimit above. That
 * one degrades to a per-replica counter because dropping a spend limit is
 * worse than being approximate. This one **fails open**: a Redis outage must
 * not make chat unusable, and the rate limit is still in force underneath as
 * the real spend ceiling. So a slot that cannot be acquired for infrastructure
 * reasons is granted, not refused.
 *
 * Slots carry a TTL so a pod that dies mid-stream cannot leak one forever —
 * without it, a crash would permanently consume a user's budget.
 */
const INFLIGHT_KEY_PREFIX = "kuwana:inflight:";

/** Longer than any legitimate stream, short enough that a leaked slot self-heals. */
const INFLIGHT_TTL_SECONDS = 300;

const inflight = new Map<string, number>();

export type ConcurrencySlot = {
  /** False when the caller is already at its cap and should be refused. */
  acquired: boolean;
  /** Always safe to call, exactly once, including when `acquired` is false. */
  release: () => Promise<void>;
};

const NOOP_SLOT: ConcurrencySlot = { acquired: true, release: async () => {} };

export async function acquireConcurrencySlot(key: string, limit: number): Promise<ConcurrencySlot> {
  const redis = getRedis();

  if (!redis) {
    // Single-server fallback. Real on one instance, per-replica on many —
    // same caveat as the in-process rate limiter, and stated for the same
    // reason: it must not be described as a distributed cap.
    const current = inflight.get(key) ?? 0;
    if (current >= limit) return { acquired: false, release: async () => {} };
    inflight.set(key, current + 1);
    let released = false;
    return {
      acquired: true,
      release: async () => {
        if (released) return;
        released = true;
        const now = inflight.get(key) ?? 0;
        if (now <= 1) inflight.delete(key);
        else inflight.set(key, now - 1);
      },
    };
  }

  const redisKey = INFLIGHT_KEY_PREFIX + key;
  let count: number;
  try {
    count = await redis.incr(redisKey);
    // Refreshed on every acquire, not just the first: a user who keeps
    // chatting should never have a live slot expire out from under them.
    await redis.expire(redisKey, INFLIGHT_TTL_SECONDS);
  } catch {
    return NOOP_SLOT; // Fail open — see the policy note above.
  }

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    try {
      await redis.decr(redisKey);
    } catch {
      // The TTL is the backstop. Nothing useful to do here.
    }
  };

  if (count > limit) {
    // Give the slot straight back — this attempt is being refused, so it must
    // not sit in the count until the TTL lapses.
    await release();
    return { acquired: false, release: async () => {} };
  }

  return { acquired: true, release };
}

/** Named budgets, same rationale as RATE_LIMITS. */
export const CONCURRENCY_LIMITS = {
  /** Simultaneous open LLM streams per user. Two devices is plausible; ten is not. */
  chatStreams: 3,
} as const;

/** Test-only: drops all recorded windows so cases cannot leak into each other. */
export function __resetRateLimits() {
  hits.clear();
  inflight.clear();
}
