import path from "node:path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Build output directory. Overridable so a verification build can run
  // while a dev server or a standalone server is still holding `.next` —
  // on Windows those handles make `next build` fail outright with EBUSY
  // rather than waiting. Defaults to `.next`, so nothing changes unless
  // NEXT_DIST_DIR is set explicitly.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Emit `.next/standalone` (a self-contained server + only the traced
  // node_modules) when building the container image. Left off elsewhere so the
  // Vercel deploy keeps using its own output pipeline unchanged — the Docker
  // build is the only thing that sets NEXT_OUTPUT_STANDALONE.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,

  // The container copies only `.next/standalone` + `.next/static` + `public`,
  // so file tracing has to be rooted at the repo, not at a guessed workspace
  // parent (Next warns and guesses wrong when multiple lockfiles are around).
  outputFileTracingRoot: process.cwd(),

  // Share the incremental cache across replicas when a store is configured.
  //
  // The default handler is per process: `revalidateTag` after an admin
  // catalog edit clears the cache on the one pod that served the write, and
  // the other replicas keep serving stale data until their own TTL expires.
  // Invisible on one replica, wrong on more than one.
  //
  // Only engaged when REDIS_URL is set, so `next dev`, a single-container
  // run and the Vercel deploy all keep the stock behaviour.
  ...(process.env.REDIS_URL
    ? {
        // An absolute path, not require.resolve: this config is loaded as an
        // ES module, where `require` does not exist.
        cacheHandler: path.join(process.cwd(), "cache-handler.js"),
        // With a shared store the per-pod memory cache is worse than
        // useless: it reintroduces exactly the stale-after-invalidation
        // window this replaces, because nothing clears it on the other pods.
        cacheMaxMemorySize: 0,
      }
    : {}),

  // The handler is resolved at runtime, so tracing cannot see it from the
  // import graph and would leave it out of the standalone bundle.
  outputFileTracingIncludes: {
    "/**/*": ["./cache-handler.js"],
  },

  // lucide-react is a barrel of ~1,500 icon modules. Without this, importing
  // three icons pulls the whole barrel into the route's client bundle — it is
  // the single largest avoidable JS payload in this app, and every page
  // imports from it.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Serve compressed responses from the Node server too, not only from a CDN
  // in front of it (Vercel already does this; a self-hosted deploy would not).
  compress: true,

  // The framework version is not a secret worth advertising to scanners.
  poweredByHeader: false,

  async headers() {
    // HSTS is production-only: sending it from a localhost dev server pins
    // the browser to HTTPS for `localhost` across every other project on the
    // machine. The whole rule is dropped rather than left with an empty
    // `headers` array — Next rejects that outright ("Invalid header found").
    //
    // Every other security header is set per-request in proxy.ts, which is
    // where the CSP nonce is minted anyway.
    //
    // No rule for /_next/static either: Next already serves those
    // content-hashed assets as `public, max-age=31536000, immutable`, and
    // overriding it makes Next warn that it can break dev-mode invalidation.
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
