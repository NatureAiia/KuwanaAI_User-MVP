/**
 * Backfills a placeholder photo onto every published listing that has none
 * yet — almost the entire catalog at time of writing, since no real
 * provider-uploaded photo exists for most seeded listings. Uses
 * picsum.photos, seeded deterministically by listing id so the same listing
 * always gets the same photo on a re-run (idempotent by construction: only
 * touches listings whose `images` array is still empty).
 *
 * Remove this backfill once real provider photo uploads make it redundant.
 *
 *   npx tsx scripts/seed-listing-placeholder-images.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";

async function seedListingPlaceholderImages() {
  const listings = await prisma.listing.findMany({
    where: { status: "published", images: { isEmpty: true } },
    select: { id: true, name: true },
  });

  for (const listing of listings) {
    const imageUrl = `https://picsum.photos/seed/${listing.id}/800/1200`;
    await prisma.listing.update({ where: { id: listing.id }, data: { images: [imageUrl] } });
    console.log(`[seed-listing-placeholder-images] "${listing.name}" (${listing.id}) -> ${imageUrl}`);
  }

  console.log(`[seed-listing-placeholder-images] done — ${listings.length} listing(s) updated.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedListingPlaceholderImages()
    .catch((err) => {
      console.error("[seed-listing-placeholder-images] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
