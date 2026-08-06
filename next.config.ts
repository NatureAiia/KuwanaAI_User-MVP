import type { NextConfig } from "next";

// Baseline security headers — none were configured at all. HSTS is included
// as defense-in-depth even though Vercel already adds it at the edge for
// HTTPS deployments — harmless in local dev since browsers only honor it
// over HTTPS.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const isDev = process.env.NODE_ENV === "development";

// A strict nonce-based CSP (the approach Next's own docs lead with) would
// force every page in the app to dynamic rendering — no static optimization,
// no CDN caching — which is a real architectural/cost trade-off, not a
// mechanical header addition, and not this pass's call to make unilaterally.
// This is the pragmatic middle ground Next's docs also document ("Without
// Nonces"): 'unsafe-inline' for script/style (the app has one static inline
// script — layout.tsx's theme-init snippet — and a handful of React inline
// `style={{}}` attributes, e.g. ProviderLogo's size-driven avatar), but
// everything else locked down to known origins. Still meaningfully blocks
// object-src/base-uri/frame-ancestors/form-action hijacking and restricts
// connect-src/img-src to origins this app actually talks to, even if it
// doesn't stop injected inline-script XSS the way a nonce-based policy would.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const CSP_HEADER = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Provider logos (Provider.logoUrl, admin-set) are arbitrary admin-curated
  // HTTPS URLs, not confined to one CDN — see src/components/ProviderLogo.tsx.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self'${SUPABASE_URL ? ` ${SUPABASE_URL}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Provider-uploaded listing images live in exactly one origin we control
// (our own Supabase Storage bucket) — unlike ProviderLogo's arbitrary
// admin-curated URLs above, this is precisely the case remotePatterns is
// for, so these get next/image instead of a plain <img>.
const supabaseHostname = (() => {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [{ protocol: "https", hostname: supabaseHostname, port: "", pathname: "/storage/v1/object/public/**", search: "" }]
      : [],
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS, { key: "Content-Security-Policy", value: CSP_HEADER }] },
    ];
  },
};

export default nextConfig;
