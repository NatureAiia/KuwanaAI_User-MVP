import { prisma } from "@/lib/prisma";
import { computeValueScores } from "@/lib/scoring";
import type { CategoryDTO, CategoryWithListingsDTO, ListingDTO } from "@/types/catalog";

function toListingDTO(listing: {
  id: string;
  name: string;
  price: unknown;
  currency: string;
  attributes: unknown;
  freshnessStatus: string;
  lastVerifiedAt: Date;
  sourceUrl: string | null;
  provider: { id: string; name: string; logoUrl: string | null; verified: boolean };
}): ListingDTO {
  return {
    id: listing.id,
    name: listing.name,
    price: Number(listing.price),
    currency: listing.currency,
    attributes: listing.attributes as Record<string, unknown>,
    freshnessStatus: listing.freshnessStatus as ListingDTO["freshnessStatus"],
    lastVerifiedAt: listing.lastVerifiedAt.toISOString(),
    sourceUrl: listing.sourceUrl,
    provider: listing.provider,
  };
}

export async function getSectorCategories(sectorSlug: string): Promise<CategoryDTO[]> {
  const sector = await prisma.sectorConfig.findUnique({
    where: { slug: sectorSlug },
    include: { categories: { include: { attributeSchema: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!sector) return [];
  return sector.categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    attributeSchema: c.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    })),
  }));
}

export async function getCategoryWithListings(
  sectorSlug: string,
  categorySlug: string,
): Promise<CategoryWithListingsDTO | null> {
  const sector = await prisma.sectorConfig.findUnique({ where: { slug: sectorSlug } });
  if (!sector) return null;

  const category = await prisma.category.findUnique({
    where: { sectorId_slug: { sectorId: sector.id, slug: categorySlug } },
    include: {
      attributeSchema: { orderBy: { sortOrder: "asc" } },
      listings: { include: { provider: true }, orderBy: { price: "asc" } },
    },
  });
  if (!category) return null;

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    attributeSchema: category.attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      dataType: a.dataType as CategoryDTO["attributeSchema"][number]["dataType"],
      unit: a.unit,
      isComparable: a.isComparable,
      sortOrder: a.sortOrder,
    })),
    listings: category.listings.map(toListingDTO),
  };
}

export async function getTopListings(
  sectorSlug: string,
  categorySlug: string,
  limit = 4,
): Promise<{ categoryName: string; listings: (ListingDTO & { score: number })[] }> {
  const result = await getCategoryWithListings(sectorSlug, categorySlug);
  if (!result) return { categoryName: "", listings: [] };

  const scores = computeValueScores(result.listings, result.attributeSchema);
  const sorted = [...result.listings]
    .map((l) => ({ ...l, score: scores[l.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { categoryName: result.name, listings: sorted };
}

export async function getListingsByIds(ids: string[]): Promise<ListingDTO[]> {
  const listings = await prisma.listing.findMany({
    where: { id: { in: ids } },
    include: { provider: true },
  });
  return listings.map(toListingDTO);
}
