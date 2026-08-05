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

  const sectors = await prisma.sectorConfig.findMany({ where: { status: "live" }, select: { slug: true } });
  const sectorEntries: MetadataRoute.Sitemap = sectors.map((s) => ({
    url: `${siteUrl}/explore/${s.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const listings = await prisma.listing.findMany({
    where: { status: "published", category: { sector: { status: "live" } } },
    select: { id: true, lastVerifiedAt: true },
    take: 5000, // sitemap protocol's own per-file cap is 50,000; this is a generous, sane ceiling for an MVP catalog
  });
  const listingEntries: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${siteUrl}/listing/${l.id}`,
    lastModified: l.lastVerifiedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...sectorEntries, ...listingEntries];
}
