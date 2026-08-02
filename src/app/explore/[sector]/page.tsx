import { notFound } from "next/navigation";
import { BottomTabBar } from "@/components/BottomTabBar";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { getSectorCategories } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";

export default async function ExploreSectorPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector } = await params;

  if (!LIVE_SECTORS.includes(sector as SectorSlug)) {
    notFound();
  }

  const meta = SECTORS[sector as SectorSlug];
  const categories = await getSectorCategories(sector);

  return (
    <div className="flex flex-1 flex-col px-5 pt-5 md:px-10">
      <h1 className="font-display text-[24px] font-bold">{meta.name}</h1>
      <p className="mt-1 text-[13px] text-text-secondary">{meta.blurb}</p>

      {categories.length === 0 ? (
        <p className="mt-8 text-text-muted">No categories seeded for this sector yet.</p>
      ) : (
        <div className="mt-4">
          <ExploreClient sectorSlug={sector} categories={categories} />
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
