import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getListingsByIds, getListingPriceTrends, getCategorySchema } from "@/lib/catalog";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { CompareClientLazy } from "@/components/LazyClients";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ sector: string }>;
  searchParams: Promise<{ category?: string; ids?: string; budget?: string; constraint?: string }>;
}) {
  const { sector } = await params;
  const { category: categoryId, ids, budget, constraint } = await searchParams;

  if (!categoryId || !ids) notFound();

  const budgetFlexibility = budget === "low" || budget === "medium" || budget === "high" ? budget : null;
  const constraints = constraint
    ? constraint
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const listingIds = ids.split(",").filter(Boolean);
  if (listingIds.length < 2) notFound();

  // Fire the four independent reads (category, listings, price trends, and
  // the Supabase auth round-trip) concurrently — the auth call in particular
  // is pure network latency that used to serialize after the DB work.
  const [category, listings, trends, user] = await Promise.all([
    getCategorySchema(categoryId),
    getListingsByIds(listingIds),
    getListingPriceTrends(listingIds),
    requireUser(),
  ]);
  if (!category) notFound();
  if (listings.length < 2) notFound();

  // Browsing/comparing without an account is supported, so this can't
  // require auth — just show nothing pre-saved for anonymous visitors.
  const initialSavedIds = user
    ? (
        await prisma.savedListing.findMany({
          where: { userId: user.id, listingId: { in: listingIds } },
          select: { listingId: true },
        })
      ).map((s) => s.listingId)
    : [];

  const attributeSchema: AttributeSchemaFieldDTO[] = category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as AttributeSchemaFieldDTO["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[22px] font-bold">Compare {category.name}</h1>
      <CompareClientLazy
        sectorSlug={sector}
        categoryId={categoryId}
        categoryName={category.name}
        listings={listings}
        attributeSchema={attributeSchema}
        trends={trends}
        initialSavedIds={initialSavedIds}
        budgetFlexibility={budgetFlexibility}
        constraints={constraints}
      />
      <BottomTabBar />
    </div>
  );
}
