import { NextResponse } from "next/server";
import { getSectorCategories, getCategoryWithListings, getListingPriceTrends } from "@/lib/catalog";
import { publicJson } from "@/lib/apiResponse";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";
import { sectorEnum } from "@/lib/zodShared";

/** Matches the catalog read layer's own TTL — see CATALOG_TTL_SECONDS in lib/catalog.ts. */
const PUBLIC_CACHE_SECONDS = 300;

export async function GET(req: Request) {
  const limited = await enforceRateLimit(`listings:${clientKey(req)}`, RATE_LIMITS.publicRead);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");
  const category = searchParams.get("category");

  if (!sector) {
    return NextResponse.json({ error: "sector is required" }, { status: 400 });
  }
  // Rejected before it reaches the cache layer: an unknown slug would
  // otherwise mint a cache entry per junk value sent.
  if (!sectorEnum.safeParse(sector).success) {
    return NextResponse.json({ error: "Unknown sector" }, { status: 400 });
  }

  if (category) {
    const result = await getCategoryWithListings(sector, category);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const trends = await getListingPriceTrends(result.listings.map((l) => l.id));
    return publicJson({ ...result, trends }, PUBLIC_CACHE_SECONDS);
  }

  const categories = await getSectorCategories(sector);
  return publicJson({ categories }, PUBLIC_CACHE_SECONDS);
}
