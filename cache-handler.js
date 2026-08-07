/**
 * Shared incremental-cache handler backed by Redis/Valkey.
 *
 * Why this file exists: Next's default cache handler keeps entries in the
 * process's memory and on that pod's filesystem. With one replica that is
 * invisible. With N replicas it produces two silent failures:
 *
 *   1. `revalidateTag(CATALOG_TAG)` after an admin edit clears the cache on
 *      the single pod that handled the write. Every other pod keeps serving
 *      the old catalog until its own TTL expires.
 *   2. The cache hit rate collapses to roughly 1/N, because each pod has to
 *      populate its own copy of every entry.
 *
 * Pointing every pod at one store fixes both. `unstable_cache`, `fetch`
 * caching and route caching all route through this class.
 *
 * Failure policy: every Redis error degrades to a cache miss, never an
 * exception. A cache outage must show up as slower responses, not as 500s —
 * the database is still there and can answer.
 *
 * Not enabled unless REDIS_URL is set, so `next dev`, `next start` and the
 * Vercel deploy keep the default behaviour with no configuration.
 */

const CACHE_PREFIX = "kuwana:cache:";
const TAG_PREFIX = "kuwana:tag:";

/** Redis connections are per process; the handler is constructed more than once. */
let sharedClient = null;
let connectionFailed = false;

function getClient() {
  if (connectionFailed) return null;
  if (sharedClient) return sharedClient;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    // Required lazily: without REDIS_URL this module must not pull ioredis
    // into the serverless/Vercel bundle at all.
    const Redis = require("ioredis");
    sharedClient = new Redis(url, {
      // A cache must never be the reason a request hangs. `commandTimeout` is
      // what enforces that — an unreachable store rejects in a second and the
      // caller falls through to the database.
      connectTimeout: 1_000,
      commandTimeout: 1_000,
      maxRetriesPerRequest: 1,
      // Left on deliberately. With it off, every command issued before the
      // asynchronous connect completes fails with "Stream isn't writeable" —
      // measured, not theorised. That covers the first requests a freshly
      // started pod serves and every reconnect window after, during which the
      // cache silently neither reads nor writes. The offline queue only holds
      // commands for as long as `commandTimeout` allows, so it cannot become
      // an unbounded backlog.
      enableOfflineQueue: true,
      lazyConnect: false,
      retryStrategy(times) {
        // Backs off to 5s and keeps trying — a restarted Valkey should be
        // picked up again without restarting every web pod.
        return Math.min(times * 200, 5_000);
      },
    });
    sharedClient.on("error", (error) => {
      // Logged once per error class, not per request: a down cache would
      // otherwise fill the pod's logs faster than the traffic it is serving.
      if (!sharedClient.__loggedError || sharedClient.__loggedError !== error.code) {
        sharedClient.__loggedError = error.code;
        console.error("[cache] redis error:", error.code ?? error.message);
      }
    });
    return sharedClient;
  } catch (error) {
    connectionFailed = true;
    console.error("[cache] redis unavailable, falling back to no caching:", error.message);
    return null;
  }
}

/**
 * Buffers survive a JSON round-trip only if they are tagged on the way out and
 * rebuilt on the way in — route-handler cache entries carry their body as a
 * Buffer, and a plain JSON.parse would hand Next back a useless object.
 */
function replacer(_key, value) {
  if (value instanceof Buffer || (value && value.type === "Buffer" && Array.isArray(value.data))) {
    return { __buffer: Buffer.from(value).toString("base64") };
  }
  return value;
}

function reviver(_key, value) {
  if (value && typeof value === "object" && typeof value.__buffer === "string") {
    return Buffer.from(value.__buffer, "base64");
  }
  return value;
}

/** Tags arrive on the context for fetch entries and on the value for route entries. */
function extractTags(data, ctx) {
  const fromCtx = ctx && Array.isArray(ctx.tags) ? ctx.tags : [];
  const fromData = data && Array.isArray(data.tags) ? data.tags : [];
  const fromHeaders =
    data && data.headers && typeof data.headers["x-next-cache-tags"] === "string"
      ? data.headers["x-next-cache-tags"].split(",")
      : [];
  return [...new Set([...fromCtx, ...fromData, ...fromHeaders])].filter(Boolean);
}

/**
 * How long an entry may sit in Redis. This is a memory bound, not the
 * revalidation window — Next decides freshness itself from `lastModified`,
 * and `revalidateTag` deletes eagerly. Without any TTL the store would grow
 * until the eviction policy started throwing away hot keys.
 */
const MAX_TTL_SECONDS = 60 * 60 * 24;

function ttlFor(ctx) {
  const revalidate = ctx && typeof ctx.revalidate === "number" ? ctx.revalidate : null;
  if (!revalidate || revalidate <= 0) return MAX_TTL_SECONDS;
  // Kept well past the revalidate window so a stale-while-revalidate read
  // still finds the entry it is meant to serve while refreshing.
  return Math.min(revalidate * 4, MAX_TTL_SECONDS);
}

module.exports = class RedisCacheHandler {
  constructor(ctx) {
    this.ctx = ctx ?? {};
  }

  async get(cacheKey) {
    const client = getClient();
    if (!client) return null;

    try {
      const raw = await client.get(CACHE_PREFIX + cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw, reviver);
      return { lastModified: parsed.lastModified, value: parsed.value };
    } catch (error) {
      console.error("[cache] get failed, treating as miss:", error.message);
      return null;
    }
  }

  async set(cacheKey, data, ctx) {
    const client = getClient();
    if (!client) return;

    try {
      const tags = extractTags(data, ctx);
      const payload = JSON.stringify({ lastModified: Date.now(), value: data, tags }, replacer);

      // Pipelined: one round-trip for the entry plus its tag memberships,
      // rather than one per tag on the write path of every cached read.
      const pipeline = client.pipeline();
      pipeline.set(CACHE_PREFIX + cacheKey, payload, "EX", ttlFor(ctx));
      for (const tag of tags) {
        pipeline.sadd(TAG_PREFIX + tag, cacheKey);
        // The tag set outlives its entries by a day; without an expiry it
        // would accumulate dead keys for the lifetime of the deployment.
        pipeline.expire(TAG_PREFIX + tag, MAX_TTL_SECONDS);
      }
      await pipeline.exec();
    } catch (error) {
      // A failed write is a future cache miss, nothing more.
      console.error("[cache] set failed:", error.message);
    }
  }

  async revalidateTag(tags) {
    const client = getClient();
    if (!client) return;

    const list = Array.isArray(tags) ? tags : [tags];
    try {
      for (const tag of list) {
        const members = await client.smembers(TAG_PREFIX + tag);
        if (members.length > 0) {
          // Chunked: a single DEL with tens of thousands of keys blocks the
          // server for the whole call, and this runs inside a user request.
          for (let i = 0; i < members.length; i += 500) {
            const chunk = members.slice(i, i + 500).map((key) => CACHE_PREFIX + key);
            await client.del(...chunk);
          }
        }
        await client.del(TAG_PREFIX + tag);
      }
    } catch (error) {
      // Worth shouting about: a failed invalidation means every pod keeps
      // serving stale data until the TTL saves it.
      console.error("[cache] revalidateTag FAILED — entries stay stale until TTL:", error.message);
    }
  }

  resetRequestCache() {
    // No per-request memoisation is kept here; the store is the only layer.
  }
};
