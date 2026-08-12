import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Provider-uploaded listing images live in exactly one origin we control
// (our own Supabase Storage bucket) — unlike ProviderLogo's arbitrary
// admin-curated URLs, this is precisely the case remotePatterns is for, so
// these get next/image instead of a plain <img>.
const supabaseHostname = (() => {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Emit `.next/standalone` when building the container image. Left off
  // elsewhere so the Vercel deploy keeps its own output pipeline unchanged.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: process.cwd(),

  // Share the incremental cache across replicas when a store is configured.
  // The default handler is per process, so `revalidateTag` after an admin
  // catalog edit clears the cache only on the pod that served the write, and
  // the hit rate collapses to roughly 1/N. Only engaged when REDIS_URL is
  // set, so dev, a single container and the Vercel deploy keep the default.
  ...(process.env.REDIS_URL
    ? { cacheHandler: require.resolve("./cache-handler.js"), cacheMaxMemorySize: 0 }
    : {}),
  // Resolved at runtime, so tracing cannot see it from the import graph and
  // would otherwise leave it out of the standalone bundle.
  outputFileTracingIncludes: { "/**/*": ["./cache-handler.js"] },

  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            port: "",
            pathname: "/storage/v1/object/public/**",
            search: "",
          },
        ]
      : [],
  },

  experimental: {
    // lucide-react is a barrel of ~1,500 icon modules. Without this,
    // importing three icons pulls the whole barrel into the route's client
    // bundle — the largest avoidable JS payload in the app.
    optimizePackageImports: ["lucide-react"],

    // Every route already has a loading.tsx shell, so this works without also
    // opting into Cache Components / Partial Prefetching. A dropped
    // connection mid-navigation keeps the pending request queued instead of
    // throwing, and shows a banner via OfflineBanner instead of a broken
    // page. Verified against a real production build. The documented
    // auto-retry-on-reconnect behaviour did NOT verify in that same test —
    // worth re-checking on a real device before relying on it.
    useOffline: true,
  },

  compress: true,
  poweredByHeader: false,

  async headers() {
    // NOTE: the Content-Security-Policy is deliberately NOT set here.
    //
    // An earlier version of this file shipped a CSP with `'unsafe-inline'` in
    // script-src, reasoning that a strict nonce-based policy "would force
    // every page to dynamic rendering — no static optimization, no CDN
    // caching". That trade-off was real, but it turns out to be avoidable, so
    // the policy now lives in proxy.ts and is strictly stronger:
    //
    //   - Next applies a per-request nonce to its own scripts by reading the
    //     CSP off the *request* headers, which the middleware sets. No page
    //     has to call headers() for that to work.
    //   - The one inline script this app authors (the anti-FOUC theme
    //     snippet) is authorised by a CSP *hash* instead of the nonce — see
    //     lib/themeScript.ts. A hash needs no per-request state, so the root
    //     layout stays static, and it is tighter than a nonce anyway: it
    //     authorises those exact bytes rather than whatever carries the nonce.
    //
    // Net result: script-src no longer needs 'unsafe-inline', so injected
    // inline-script XSS is actually blocked, and nothing is forced dynamic.
    //
    // HSTS stays here rather than in the middleware, and only in production:
    // sending it from a localhost dev server pins the browser to HTTPS for
    // `localhost` across every other project on the machine. The whole rule
    // is dropped in dev rather than left with an empty `headers` array, which
    // Next rejects outright ("Invalid header found").
    if (isDev) return [];

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
