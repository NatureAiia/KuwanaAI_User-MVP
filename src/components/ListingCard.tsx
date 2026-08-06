"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Bookmark, BookmarkCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { ProviderLogo } from "@/components/ProviderLogo";
import { PriceSparkline } from "@/components/PriceSparkline";
import { Badge } from "@/components/ui/Card";
import { FRESHNESS_TONE, TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";
import { notifyGamification } from "@/lib/gamification/client";
import { useCurrency } from "@/components/CurrencyProvider";
import type { ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import type { Requirement } from "@/lib/eligibility";

export function ListingCard({
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

  return (
    <div
      className={clsx(
        "relative flex flex-col rounded-[var(--radius-card)] border bg-bg-surface p-4 transition-all",
        selected ? "border-accent-sky shadow-[0_0_0_1px_var(--accent-sky)]" : "border-border",
      )}
    >
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleSaved}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${listing.name} from saved` : `Save ${listing.name}`}
          className="tap-target flex h-7 w-7 items-center justify-center rounded-full border border-border bg-bg-surface-raised text-accent-sky"
        >
          {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
        <button
          type="button"
          onClick={() => onToggleSelect(listing)}
          aria-pressed={selected}
          aria-label={selected ? `Remove ${listing.name} from comparison` : `Add ${listing.name} to comparison`}
          className={clsx(
            "tap-target flex h-7 w-7 items-center justify-center rounded-full border",
            selected ? "border-accent-sky bg-accent-sky text-[var(--text-on-accent-sky)]" : "border-border bg-bg-surface-raised",
          )}
        >
          {selected && <CheckCircle2 size={16} />}
        </button>
      </div>

      <div className="flex items-start justify-between gap-3 pr-16">
        <div className="flex items-start gap-2.5">
          <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={32} />
          <div>
            <p className="font-display text-[15px] font-semibold leading-tight">{listing.name}</p>
            <p className="mt-1 flex items-center gap-1 text-[12px] text-text-muted">
              {listing.provider.verified && <ShieldCheck size={12} className="text-accent-teal" />}
              {listing.provider.name}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <p className="font-mono text-[22px] font-semibold text-text-primary">
              {display(listing.price, listing.currency)}
            </p>
            {hasSavings && (
              <p className="font-mono text-[13px] text-text-muted line-through">
                {display(trend!.earliestPrice, listing.currency)}
              </p>
            )}
            {trend && trend.points.length >= 2 && (
              <PriceSparkline points={trend.points} direction={trend.direction} width={44} height={18} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        </div>
        <SignalBloom value={score} size={56} />
      </div>

      <Link
        href={`/listing/${listing.id}?sector=${sectorSlug}`}
        className="tap-target mt-4 flex items-center justify-center rounded-xl border border-border text-[13px] font-semibold text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
      >
        View details
      </Link>
    </div>
  );
}
