import { NextResponse } from "next/server";

/**
 * Caching intent, stated explicitly at every JSON response rather than left
 * to a framework default.
 *
 * Next route handlers are uncached by default, but "uncached by the
 * framework" is not the same as "uncached by the browser, a corporate
 * proxy, or a CDN sitting in front of the deploy" — none of those see a
 * directive unless one is sent. Every response carrying user-scoped data
 * (saved listings, notifications, XP, consents, footprint, leaderboard
 * position, admin views) must therefore say `no-store` itself.
 */
export function privateJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Vary", "Cookie");
  return response;
}

/**
 * Public, non-user-scoped data (catalog listings, FX rates). Cacheable by
 * shared caches, with stale-while-revalidate so a cold revalidation never
 * makes a user wait on the database.
 */
export function publicJson(body: unknown, maxAgeSeconds: number, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set(
    "Cache-Control",
    `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}`,
  );
  return response;
}
