import type { NextConfig } from "next";

// Baseline security headers — none were configured at all. Deliberately not
// including a Content-Security-Policy here: getting one right without
// breaking something requires auditing every inline style/script across the
// app (SVG components, next/script's theme-init snippet, etc.), which is a
// separate, more careful pass than these mechanical, well-understood
// defaults. HSTS is included as defense-in-depth even though Vercel already
// adds it at the edge for HTTPS deployments — harmless in local dev since
// browsers only honor it over HTTPS.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
