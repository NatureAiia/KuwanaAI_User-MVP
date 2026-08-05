import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getListingsByIds, getListingPriceTrends } from "@/lib/catalog";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { CompareClientLazy } from "@/components/LazyClients";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ sector: string }>;
  searchParams: Promise<{ category?: string; ids?: string }>;
}) {
  const { sector } = await params;
  const { category: categoryId, ids } = await searchParams;

  if (!categoryId || !ids) notFound();

  const listingIds = ids.split(",").filter(Boolean);
  if (listingIds.length < 2) notFound();

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { attributeSchema: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) notFound();

  const listings = await getListingsByIds(listingIds);
  if (listings.length < 2) notFound();

  const trends = await getListingPriceTrends(listingIds);

  const attributeSchema: AttributeSchemaFieldDTO[] = category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as AttributeSchemaFieldDTO["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[22px] font-bold">Compare {category.name}</h1>
      <CompareClientLazy
        sectorSlug={sector}
        categoryId={categoryId}
        categoryName={category.name}
        listings={listings}
        attributeSchema={attributeSchema}
        trends={trends}
      />
      <BottomTabBar />
    </div>
  );
}
