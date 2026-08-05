import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

// Everything behind requireUser()/requireConsumer()/requireAdmin() is
// disallowed — there's no SEO value in a search engine indexing a login
// wall, and no reason to publicly list where the admin/provider panels
// live. Mirrors proxy.ts's PROTECTED_PREFIXES; kept as an explicit list
// here rather than importing that array, since middleware protection and
// crawler guidance are different concerns that happen to overlap today.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/profile",
        "/leaderboard",
        "/settings",
        "/chat",
        "/admin",
        "/corporate",
        "/regulator",
        "/notifications",
        "/provider",
        "/api",
      ],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
