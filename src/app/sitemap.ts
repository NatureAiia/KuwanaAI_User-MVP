import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/siteUrl";

// Only the genuinely public, crawlable surface — matches robots.ts's allow
// list. Listing pages are the highest-value entries here (the specific
// thing someone would actually search for, e.g. "CBZ savings account fees
// Zimbabwe") and there was no way for a crawler to discover them at all
// without following an authenticated user's session-scoped links first.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  // The database reads are best-effort. This route is evaluated during the
  // production build's static export, so an unreachable database used to
  // fail `next build` outright ("Export encountered an error on
  // /sitemap.xml/route, exiting the build") — a transient DB blip could
  // block a deploy that has nothing else wrong with it.
  //
  // Degrading to the static entries is strictly better than that: a sitemap
  // is a crawler hint, not a correctness surface, and the next successful
  // build restores the full list. The error is logged so a persistently
  // truncated sitemap is still visible in the build output.
  let dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const [sectors, listings] = await Promise.all([
      prisma.sectorConfig.findMany({ where: { status: "live" }, select: { slug: true } }),
      prisma.listing.findMany({
        where: { status: "published", category: { sector: { status: "live" } } },
        select: { id: true, lastVerifiedAt: true },
        take: 5000, // sitemap protocol's own per-file cap is 50,000; this is a generous, sane ceiling for an MVP catalog
      }),
    ]);

    dynamicEntries = [
      ...sectors.map((s) => ({
        url: `${siteUrl}/explore/${s.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...listings.map((l) => ({
        url: `${siteUrl}/listing/${l.id}`,
        lastModified: l.lastVerifiedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] database unreachable — emitting static entries only:", error);
  }

  return [...staticEntries, ...dynamicEntries];
}
