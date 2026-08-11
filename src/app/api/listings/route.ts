import { NextResponse } from "next/server";
import { getSectorCategories, getCategoryWithListings, getListingPriceTrends } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");
  const category = searchParams.get("category");

  if (!sector) {
    return NextResponse.json({ error: "sector is required" }, { status: 400 });
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

    return NextResponse.json({ ...result, trends, savedIds });
  }

  const categories = await getSectorCategories(sector);
  return NextResponse.json({ categories });
}
