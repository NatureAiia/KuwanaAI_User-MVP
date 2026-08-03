"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowUpDown } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/Button";
import { computeDecisionScores } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/client";
import type { CategoryDTO, CategoryWithListingsDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";

type SortMode = "value" | "price_asc" | "price_desc";
type CategoryWithTrendsDTO = CategoryWithListingsDTO & { trends: Record<string, PriceTrend | null> };

const MIN_COMPARE = 2;
const MAX_COMPARE = 4;

export function ExploreClient({
  sectorSlug,
  categories,
}: {
  sectorSlug: string;
  categories: CategoryDTO[];
}) {
  const router = useRouter();
  const [activeCategorySlug, setActiveCategorySlug] = useState(categories[0]?.slug ?? "");
  const [data, setData] = useState<CategoryWithTrendsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortMode>("value");
  const [selected, setSelected] = useState<string[]>([]);
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
    setSelected([]);
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

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  function goCompare() {
    if (!data || selected.length < MIN_COMPARE) return;
    if (isAuthed === false) {
      router.push(`/signup?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    router.push(
      `/explore/${sectorSlug}/compare?category=${data.id}&ids=${selected.join(",")}`,
    );
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
            selected={selected.includes(listing.id)}
            onToggleSelect={toggleSelect}
          />
        ))}
      </div>

      {selected.length >= 1 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center px-5 md:bottom-6">
          <div className="flex items-center gap-4 rounded-full border border-accent-sky bg-bg-surface px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
            <span className="text-[13px] font-medium">
              {selected.length < MIN_COMPARE
                ? `Select ${MIN_COMPARE - selected.length} more to compare`
                : `${selected.length} selected${selected.length >= MAX_COMPARE ? ` (max ${MAX_COMPARE})` : ""}`}
            </span>
            <Button size="md" onClick={goCompare} disabled={selected.length < MIN_COMPARE}>
              Compare
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
