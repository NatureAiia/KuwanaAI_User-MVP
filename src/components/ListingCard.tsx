"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Bookmark, BookmarkCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { ProviderLogo } from "@/components/ProviderLogo";
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
  selected,
  onToggleSelect,
  requirements,
  initialSaved,
}: {
  listing: ListingDTO;
  score: number;
  trend?: PriceTrend | null;
  sectorSlug: string;
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
        "relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border bg-bg-surface transition-all",
        selected ? "border-accent-sky shadow-[0_0_0_1px_var(--accent-sky)]" : "border-border",
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

        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleSaved}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${listing.name} from saved` : `Save ${listing.name}`}
            className="tap-target flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-surface/90 text-accent-sky backdrop-blur"
          >
            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
          <button
            type="button"
            onClick={() => onToggleSelect(listing)}
            aria-pressed={selected}
            aria-label={selected ? `Remove ${listing.name} from comparison` : `Add ${listing.name} to comparison`}
            className={clsx(
              "tap-target flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur",
              selected ? "border-accent-sky bg-accent-sky text-[var(--text-on-accent-sky)]" : "border-border bg-bg-surface/90",
            )}
          >
            {selected && <CheckCircle2 size={16} />}
          </button>
        </div>

        <div className="absolute bottom-2 left-2">
          <SignalBloom value={score} size={40} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start gap-2">
          <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={22} />
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-semibold leading-tight">{listing.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
              {listing.provider.verified && <ShieldCheck size={11} className="text-accent-teal" />}
              {listing.provider.name}
            </p>
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
