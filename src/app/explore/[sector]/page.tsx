import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { TrendingRow } from "@/components/explore/TrendingRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { LayoutGrid } from "lucide-react";
import { getSectorCategories, getTrendingListings } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sector: string }>;
}): Promise<Metadata> {
  const { sector } = await params;
  if (!LIVE_SECTORS.includes(sector as SectorSlug)) return {};
  const meta = SECTORS[sector as SectorSlug];
  return {
    title: `${meta.name} — Compare on Kuwana`,
    description: `${meta.blurb} — compare ${meta.name.toLowerCase()} providers in Zimbabwe with transparent decision scores.`,
  };
}

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
  const [categories, trending] = await Promise.all([
    getSectorCategories(sector),
    getTrendingListings(sector),
  ]);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pt-5 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">{meta.name}</h1>
      <p className="mt-1 text-[13px] text-text-secondary">{meta.blurb}</p>

      <TrendingRow items={trending} />

      {categories.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={LayoutGrid}
          title="No categories yet"
          description={`We haven't seeded any categories for ${meta.name.toLowerCase()} yet — check back soon.`}
        />
      ) : (
        <div className="mt-4">
          <ExploreClient sectorSlug={sector} categories={categories} />
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
