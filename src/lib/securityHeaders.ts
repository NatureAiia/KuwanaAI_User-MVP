import { THEME_INIT_SCRIPT_CSP_HASH } from "@/lib/themeScript";

/**
 * Security response headers, in one place so the edge middleware and any
 * future custom server agree on exactly one policy.
 *
 * The CSP is nonce-based rather than `'unsafe-inline'`: proxy.ts mints a
 * fresh nonce per request and Next.js propagates it onto its own inline
 * bootstrap scripts (and the `<Script>` in layout.tsx) by reading it back
 * off the request's own CSP header. That is the only way to keep a strict
 * script policy while still shipping Next's inline hydration payload.
 *
 * `style-src` still allows inline: Tailwind v4 and React's `style={{...}}`
 * props both emit inline styles, and there is no nonce plumbing for those.
 * Inline styles are a far weaker XSS primitive than inline scripts, so this
 * is the standard tradeoff rather than an oversight.
 */
export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives = [
    `default-src 'self'`,
    // Nonce for Next's own per-request bootstrap; hash for the one inline
    // script this app authors itself (see lib/themeScript.ts for why that one
    // must not use the nonce). 'strict-dynamic' lets the nonced bootstrap
    // load its own chunks without enumerating every chunk URL here.
    //
    // Note that under CSP3 'strict-dynamic' causes the hash to be ignored for
    // *dynamically inserted* scripts, but a hash still authorises a parser-
    // inserted inline script like this one — which is exactly how it ships.
    `script-src 'self' 'nonce-${nonce}' ${THEME_INIT_SCRIPT_CSP_HASH} 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    // Provider logos are arbitrary operator-supplied URLs (Provider.logoUrl),
    // so images cannot be locked to 'self'. data: covers inline SVG/blur
    // placeholders; blob: covers the chat composer's local image preview.
    `img-src 'self' https: data: blob:`,
    `font-src 'self' data:`,
    // Supabase auth/realtime is same-origin-proxied in this app, but the
    // browser SDK still talks to the project URL directly on token refresh.
    `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} ${isDev ? "ws: http://localhost:*" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ];
  return directives.map((d) => d.replace(/\s{2,}/g, " ").trim()).join("; ");
}

/**
 * Headers that never vary per request. HSTS is deliberately omitted here and
 * set in next.config.ts instead — it must not be sent over plain HTTP on
 * localhost, and next.config's header rules are easier to scope than the
 * middleware's catch-all matcher.
 */
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  // Redundant with CSP frame-ancestors for modern browsers; kept for older
  // ones that only understand this header.
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-DNS-Prefetch-Control": "off",
  // Nothing in this app uses these; deny by default rather than inherit the
  // browser's permissive default.
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
