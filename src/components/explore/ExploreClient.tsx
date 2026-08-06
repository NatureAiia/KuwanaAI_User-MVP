"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ArrowUpDown } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { CompareTrayBar } from "@/components/explore/CompareTrayBar";
import { computeDecisionScores } from "@/lib/scoring";
import { getListingRequirements } from "@/lib/eligibility";
import { createClient } from "@/lib/supabase/client";
import { useCompareTray } from "@/lib/useCompareTray";
import type { CategoryDTO, CategoryWithListingsDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";

type SortMode = "value" | "price_asc" | "price_desc";
type CategoryWithTrendsDTO = CategoryWithListingsDTO & { trends: Record<string, PriceTrend | null> };

export function ExploreClient({
  sectorSlug,
  categories,
}: {
  sectorSlug: string;
  categories: CategoryDTO[];
}) {
  const searchParams = useSearchParams();
  const requestedCategorySlug = searchParams.get("category");
  const initialCategorySlug =
    (requestedCategorySlug && categories.some((c) => c.slug === requestedCategorySlug)
      ? requestedCategorySlug
      : categories[0]?.slug) ?? "";
  const [activeCategorySlug, setActiveCategorySlug] = useState(initialCategorySlug);
  const [data, setData] = useState<CategoryWithTrendsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("value");
  const { toggle, isSelected } = useCompareTray();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setIsAuthed(!!data.user));
  }, []);

  useEffect(() => {
    if (!activeCategorySlug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting view state for the incoming fetch, not deriving render output
    setLoading(true);
    fetch(`/api/listings?sector=${sectorSlug}&category=${activeCategorySlug}`)
      .then((r) => r.json())
      .then((d: CategoryWithTrendsDTO) => setData(d))
      .finally(() => setLoading(false));

    if (isAuthed) {
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "comparison_viewed", sector: sectorSlug }),
      }).catch(() => {});
    }
  }, [activeCategorySlug, sectorSlug, isAuthed]);

  const scores = useMemo(
    () => (data ? computeDecisionScores(data.listings, data.attributeSchema, data.trends) : {}),
    [data],
  );

  const sortedListings = useMemo(() => {
    if (!data) return [];
    const listings = [...data.listings];
    if (sort === "price_asc") listings.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") listings.sort((a, b) => b.price - a.price);
    else listings.sort((a, b) => (scores[b.id]?.total ?? 0) - (scores[a.id]?.total ?? 0));
    return listings;
  }, [data, sort, scores]);

  function toggleSelect(listing: (typeof sortedListings)[number]) {
    if (!data) return;
    toggle(sectorSlug, data.id, data.name, {
      id: listing.id,
      name: listing.name,
      providerName: listing.provider.name,
      providerLogoUrl: listing.provider.logoUrl,
    });
  }

  return (
    <div className="pb-28">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => setActiveCategorySlug(cat.slug)}
            className={clsx(
              "tap-target shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium",
              activeCategorySlug === cat.slug
                ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                : "border-border text-text-secondary",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-[13px] text-text-muted">
          {loading ? "Loading…" : `${sortedListings.length} listings`}
        </p>
        <button
          onClick={() =>
            setSort((s) => (s === "value" ? "price_asc" : s === "price_asc" ? "price_desc" : "value"))
          }
          className="tap-target flex items-center gap-1.5 text-[13px] font-medium text-text-secondary"
        >
          <ArrowUpDown size={14} />
          {sort === "value" ? "Best value" : sort === "price_asc" ? "Price: low to high" : "Price: high to low"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sortedListings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            score={scores[listing.id]?.total ?? 0}
            trend={data?.trends[listing.id] ?? null}
            sectorSlug={sectorSlug}
            selected={data ? isSelected(data.id, listing.id) : false}
            onToggleSelect={toggleSelect}
            requirements={data ? getListingRequirements(listing, data.attributeSchema) : undefined}
          />
        ))}
      </div>

      <CompareTrayBar />
    </div>
  );
}
