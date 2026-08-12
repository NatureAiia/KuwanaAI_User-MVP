import { NextResponse } from "next/server";
import { getSectorCategories, getCategoryWithListings, getListingPriceTrends } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson, publicJson } from "@/lib/apiResponse";
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
    // Overlap the Supabase auth call (slow, network) with the category read
    // so they don't serialize. Trends + saved-list lookup then run in
    // parallel once both are available.
    const [user, result] = await Promise.all([
      requireUser(),
      getCategoryWithListings(sector, category),
    ]);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const listingIds = result.listings.map((l) => l.id);

    // Browsing without an account is supported (see the homepage's "Browse
    // now, sign up when you're ready" CTA), so this can't require auth -
    // just skip the saved lookup for anonymous visitors.
    const [trends, savedRows] = await Promise.all([
      getListingPriceTrends(listingIds),
      user
        ? prisma.savedListing.findMany({
            where: { userId: user.id, listingId: { in: listingIds } },
            select: { listingId: true },
          })
        : Promise.resolve([]),
    ]);
    const savedIds = savedRows.map((s) => s.listingId);

    // no-store, NOT the shared cache used below. `savedIds` is scoped to the
    // caller, so an s-maxage here would let a CDN serve one user's saved
    // listings to the next visitor. The expensive part is still cached —
    // getCategoryWithListings and getListingPriceTrends are both wrapped in
    // unstable_cache — so this only gives up HTTP-level sharing, not the
    // database win.
    return privateJson({ ...result, trends, savedIds });
  }

  // No user-scoped data on this branch, so it stays shared-cacheable.
  const categories = await getSectorCategories(sector);
  return publicJson({ categories }, PUBLIC_CACHE_SECONDS);
}
