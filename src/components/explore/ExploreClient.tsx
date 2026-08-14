"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ArrowUpDown, ShieldCheck } from "lucide-react";
import { Skeleton } from "boneyard-js/react";
import { ListingCard } from "@/components/ListingCard";
import { ListingCardFixture } from "@/components/explore/ListingCardFixture";
import { CompareTrayBar } from "@/components/explore/CompareTrayBar";
import { computeDecisionScores } from "@/lib/scoring";
import { getListingRequirements } from "@/lib/eligibility";
import { createClient } from "@/lib/supabase/client";
import { useCompareTray } from "@/lib/useCompareTray";
import type { CategoryDTO, CategoryWithListingsDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";

type SortMode = "value" | "price_asc" | "price_desc";
type CategoryWithTrendsDTO = CategoryWithListingsDTO & {
  trends: Record<string, PriceTrend | null>;
  savedIds: string[];
};

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
  // Hides listings with a stated qualification requirement (e.g. a minimum
  // balance) — purely data-driven, so it never guesses whether a specific
  // user qualifies; it only drops options that *do* carry a requirement.
  const [eligibleOnly, setEligibleOnly] = useState(false);
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

  const savedIds = useMemo(() => new Set(data?.savedIds ?? []), [data]);

  // Computed once per fetch rather than inline in the JSX below — an inline
  // `getListingRequirements(...)` call produces a brand-new array reference
  // on every render, which would defeat ListingCard's memoization below just
  // as effectively as not memoizing it at all.
  const requirementsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getListingRequirements>>();
    if (data) for (const listing of data.listings) map.set(listing.id, getListingRequirements(listing, data.attributeSchema));
    return map;
  }, [data]);

  const sortedListings = useMemo(() => {
    if (!data) return [];
    let listings = [...data.listings];
    if (eligibleOnly) {
      listings = listings.filter((l) => (requirementsById.get(l.id)?.length ?? 0) === 0);
    }
    if (sort === "price_asc") listings.sort((a, b) => a.price - b.price);
    else if (sort === "price_desc") listings.sort((a, b) => b.price - a.price);
    else listings.sort((a, b) => (scores[b.id]?.total ?? 0) - (scores[a.id]?.total ?? 0));
    return listings;
  }, [data, sort, scores, eligibleOnly, requirementsById]);

  // Stable across renders (via useCallback) for the same reason as
  // requirementsById above — ListingCard is memoized, and an inline function
  // recreated on every ExploreClient render would defeat that for every card,
  // not just the one actually being toggled.
  const toggleSelect = useCallback(
    (listing: ListingDTO) => {
      if (!data) return;
      toggle(sectorSlug, data.id, data.name, {
        id: listing.id,
        name: listing.name,
        providerName: listing.provider.name,
        providerLogoUrl: listing.provider.logoUrl,
      });
    },
    [data, sectorSlug, toggle],
  );

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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-text-muted">
          {loading
            ? "Loading…"
            : eligibleOnly
              ? `${sortedListings.length} of ${data?.listings.length ?? 0} eligible`
              : `${sortedListings.length} listings`}
        </p>
        <div className="flex items-center gap-1.5">
          {data?.listings.some((l) => (requirementsById.get(l.id)?.length ?? 0) > 0) && (
            <button
              onClick={() => setEligibleOnly((v) => !v)}
              aria-pressed={eligibleOnly}
              className={clsx(
                "tap-target flex items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
                eligibleOnly
                  ? "border-accent-teal bg-accent-teal/15 text-accent-teal"
                  : "border-border text-text-secondary",
              )}
            >
              <ShieldCheck size={14} />
              No qualification required
            </button>
          )}
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
      </div>

      <Skeleton
        name="explore-listings"
        loading={loading}
        transition
        fixture={<ListingCardFixture />}
      >
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {sortedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              score={scores[listing.id]?.total ?? 0}
              trend={data?.trends[listing.id] ?? null}
              sectorSlug={sectorSlug}
              categorySlug={activeCategorySlug}
              selected={data ? isSelected(data.id, listing.id) : false}
              onToggleSelect={toggleSelect}
              initialSaved={savedIds.has(listing.id)}
              requirements={requirementsById.get(listing.id)}
            />
          ))}
        </div>
      </Skeleton>

      <CompareTrayBar />
    </div>
  );
}
