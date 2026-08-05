/** Canonical absolute site URL — robots.ts/sitemap.ts both need one, metadata routes can't infer it from a request. */
export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
