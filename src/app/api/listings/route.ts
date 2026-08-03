import { NextResponse } from "next/server";
import { getSectorCategories, getCategoryWithListings, getListingPriceTrends } from "@/lib/catalog";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector");
  const category = searchParams.get("category");

  if (!sector) {
    return NextResponse.json({ error: "sector is required" }, { status: 400 });
  }

  if (category) {
    const result = await getCategoryWithListings(sector, category);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const trends = await getListingPriceTrends(result.listings.map((l) => l.id));
    return NextResponse.json({ ...result, trends });
  }

  const categories = await getSectorCategories(sector);
  return NextResponse.json({ categories });
}
