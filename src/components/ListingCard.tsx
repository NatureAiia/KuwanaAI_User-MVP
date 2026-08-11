"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Bookmark, BookmarkCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { ProviderLogo } from "@/components/ProviderLogo";
import { CategoryBadge } from "@/components/CategoryBadge";
import { ListingCoverArt } from "@/components/ListingCoverArt";
import { PriceSparkline } from "@/components/PriceSparkline";
import { Badge } from "@/components/ui/Card";
import { FRESHNESS_TONE, TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";
import { notifyGamification } from "@/lib/gamification/client";
import { useCurrency } from "@/components/CurrencyProvider";
import type { ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import type { Requirement } from "@/lib/eligibility";

// Memoized: this renders once per listing in a grid that can run to dozens
// of cards, and profiling (4x CPU throttle, approximating a mid-range
// Android) showed every card re-rendering on a single card's own selection
// toggle or a sort-order change was pushing interaction latency into Core
// Web Vitals' "needs improvement" band (~300ms). Only pays off because the
// parent (ExploreClient) also keeps `onToggleSelect` and `requirements`
// referentially stable — an inline arrow function or a fresh array on every
// parent render would defeat this for every card, not just the changed one.
export const ListingCard = memo(function ListingCard({
  listing,
  score,
  trend,
  sectorSlug,
  categorySlug,
  selected,
  onToggleSelect,
  requirements,
  initialSaved,
}: {
  listing: ListingDTO;
  score: number;
  trend?: PriceTrend | null;
  sectorSlug: string;
  categorySlug?: string;
  selected: boolean;
  onToggleSelect: (listing: ListingDTO) => void;
  requirements?: Requirement[];
  initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved ?? false);
  const { display } = useCurrency();

  async function toggleSaved() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    const res = await fetch("/api/saved", {
      method: nextSaved ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id }),
    }).catch(() => null);
    if (res?.ok && nextSaved) {
      const data = await res.json();
      notifyGamification(data?.gamification);
    }
  }

  const hasSavings = trend && trend.direction === "down" && trend.earliestPrice > trend.currentPrice;

  const coverImage = listing.images[0];

  return (
    <div
      className={clsx(
        // Card chrome: 12px radius, soft drop-shadow, smooth transition.
        // The shadow + radius combination is the same as the rest of the app's
        // surface cards (see DPO_TRUST_UX_ARCHITECTURE.md §5.2), kept here so
        // bundle cards read as part of the same family as category tiles.
        "bundle-card-header relative flex flex-col overflow-hidden rounded-[12px] border bg-bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-4px_rgba(0,0,0,0.08)] transition-all",
        selected ? "border-accent-sky shadow-[0_0_0_1px_var(--accent-sky),0_4px_12px_-4px_var(--accent-sky)]" : "border-border",
      )}
    >
      <div className="relative aspect-[4/3] w-full">
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider-uploaded, arbitrary aspect ratios not worth next/image's fixed-size ceremony here
          <img
            src={coverImage}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="h-full w-full object-cover"
          />
        ) : (
          <ListingCoverArt seed={listing.id} className="h-full w-full" />
        )}

        <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={toggleSaved}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${listing.name} from shopping list` : `Add ${listing.name} to shopping list`}
            className={clsx(
              "tap-target flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition-colors",
              saved
                ? "border-accent-sky bg-accent-sky text-[var(--text-on-accent-sky)]"
                : "border-border bg-bg-surface/95 text-accent-sky hover:border-accent-sky/60",
            )}
          >
            {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => onToggleSelect(listing)}
            aria-pressed={selected}
            aria-label={selected ? `Remove ${listing.name} from comparison` : `Add ${listing.name} to comparison`}
            className={clsx(
              "tap-target flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition-colors",
              selected
                ? "border-accent-sky bg-accent-sky text-[var(--text-on-accent-sky)]"
                : "border-border bg-bg-surface/95 text-text-secondary hover:border-accent-sky/60 hover:text-accent-sky",
            )}
          >
            {selected && <CheckCircle2 size={13} />}
            {selected ? "Added" : "Compare"}
          </button>
        </div>

        {/* Bottom-left: progress ring. Sized to match the right-side header
            so the card has flex-space-between symmetry. */}
        <div className="absolute bottom-2 left-2">
          <SignalBloom value={score} size={40} />
        </div>
      </div>

      {/* Card body — flex justify-between the provider logo (left) and the
          category badge (right of title). The provider logo is constrained to
          max-h: 20px / max-w: 60px via the inline `style` (Tailwind has no
          arbitrary max-* utility for inline styles, and this guarantees the
          layout brief is honored regardless of the image's intrinsic size). */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <ProviderLogo
              name={listing.provider.name}
              logoUrl={listing.provider.logoUrl}
              size={22}
              className="max-h-[20px] max-w-[60px]"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {categorySlug && (
                  <CategoryBadge
                    categorySlug={categorySlug}
                    attributes={listing.attributes}
                    size={13}
                  />
                )}
                <p className="truncate font-display text-[14px] font-semibold leading-tight">
                  {listing.name}
                </p>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
                {listing.provider.verified && <ShieldCheck size={11} className="text-accent-teal" />}
                {listing.provider.name}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-baseline gap-1.5">
          <p className="font-mono text-[18px] font-semibold text-text-primary">
            {display(listing.price, listing.currency)}
          </p>
          {hasSavings && (
            <p className="font-mono text-[11px] text-text-muted line-through">
              {display(trend!.earliestPrice, listing.currency)}
            </p>
          )}
          {trend && trend.points.length >= 2 && (
            <PriceSparkline points={trend.points} direction={trend.direction} width={36} height={16} />
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge tone={FRESHNESS_TONE[listing.freshnessStatus]}>{listing.freshnessStatus}</Badge>
          {trend && trend.direction !== "flat" && (
            <Badge tone={TREND_TONE[trend.direction]}>
              {hasSavings
                ? `Save ${Math.abs(trend.changePercent)}%`
                : `${TREND_ARROW[trend.direction]} ${Math.abs(trend.changePercent)}%`}
            </Badge>
          )}
          {requirements?.map((r) => (
            <Badge key={r.key} tone="sky">
              {r.label} {String(r.value)}
              {r.unit ? ` ${r.unit}` : ""}
            </Badge>
          ))}
        </div>

        <Link
          href={`/listing/${listing.id}?sector=${sectorSlug}`}
          className="tap-target mt-2.5 flex items-center justify-center rounded-xl border border-border text-[12px] font-semibold text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
        >
          View details
        </Link>
      </div>
    </div>
  );
});
