import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getListingsByIds } from "@/lib/catalog";
import { BottomTabBar } from "@/components/BottomTabBar";
import { CompareClient } from "@/components/explore/CompareClient";
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
      <h1 className="font-display text-[22px] font-bold">Compare {category.name}</h1>
      <CompareClient
        sectorSlug={sector}
        categoryId={categoryId}
        categoryName={category.name}
        listings={listings}
        attributeSchema={attributeSchema}
      />
      <BottomTabBar />
    </div>
  );
}
