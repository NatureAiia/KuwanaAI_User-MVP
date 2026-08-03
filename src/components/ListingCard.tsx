"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { ProviderLogo } from "@/components/ProviderLogo";
import { Badge } from "@/components/ui/Card";
import { FRESHNESS_TONE, TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";
import type { ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";

export function ListingCard({
  listing,
  score,
  trend,
  sectorSlug,
  selected,
  onToggleSelect,
}: {
  listing: ListingDTO;
  score: number;
  trend?: PriceTrend | null;
  sectorSlug: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div
      className={clsx(
        "relative flex flex-col rounded-[var(--radius-card)] border bg-bg-surface p-4 transition-all",
        selected ? "border-accent-sky shadow-[0_0_0_1px_var(--accent-sky)]" : "border-border",
      )}
    >
      <button
        type="button"
        onClick={() => onToggleSelect(listing.id)}
        aria-pressed={selected}
        aria-label={selected ? `Remove ${listing.name} from comparison` : `Add ${listing.name} to comparison`}
        className={clsx(
          "tap-target absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border",
          selected ? "border-accent-sky bg-accent-sky text-[var(--text-on-accent-sky)]" : "border-border bg-bg-surface-raised",
        )}
      >
        {selected && <CheckCircle2 size={16} />}
      </button>

      <div className="flex items-start justify-between gap-3 pr-8">
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
          <p className="font-mono text-[22px] font-semibold text-text-primary">
            {listing.currency} {listing.price.toFixed(2)}
          </p>
          <Badge tone={FRESHNESS_TONE[listing.freshnessStatus]} className="mt-2">
            {listing.freshnessStatus}
          </Badge>
          {trend && trend.direction !== "flat" && (
            <Badge tone={TREND_TONE[trend.direction]} className="mt-2">
              {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}%
            </Badge>
          )}
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
