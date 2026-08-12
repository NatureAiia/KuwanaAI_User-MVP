import Link from "next/link";
import { SignalBloom } from "@/components/SignalBloom";
import { ProviderLogo } from "@/components/ProviderLogo";
import { Badge } from "@/components/ui/Card";
import { FormattedPrice } from "@/components/FormattedPrice";
import type { ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";

export type HeroCarouselListing = ListingDTO & {
  score: number;
  trend?: PriceTrend | null;
  reason?: string | null;
  /** Sector the listing belongs to. Falls back to the carousel's `sectorSlug`. */
  sectorSlug?: string;
  /** Category name to show as a small chip on mixed (cross-category) carousels. */
  categoryName?: string;
};

/**
 * A horizontally-scrolling row of decision-score cards. Used for both
 * single-category feeds (Specials, Best value) and cross-category mixes
 * (Recommended for you) — when `sectorSlug` is set per-listing, each card
 * deep-links into its own sector and shows its category as a chip.
 */
export function HeroCarousel({
  title,
  sectorSlug,
  listings,
}: {
  title: string;
  sectorSlug?: string;
  listings: HeroCarouselListing[];
}) {
  if (listings.length === 0) return null;

  return (
    <section className="mt-2">
      <h2 className="font-display text-[18px] font-semibold">{title}</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listing/${listing.id}?sector=${listing.sectorSlug ?? sectorSlug ?? "telecom"}`}
            className="w-[220px] shrink-0 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={28} />
                <div className="min-w-0">
                  <p className="truncate font-display text-[14px] font-semibold leading-tight">
                    {listing.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-text-muted">{listing.provider.name}</p>
                </div>
              </div>
              <SignalBloom value={listing.score} size={44} />
            </div>
            {listing.categoryName && (
              <span className="mt-2 inline-block max-w-full truncate rounded-full border border-accent-sky/30 bg-accent-sky/10 px-2 py-0.5 text-[10px] font-semibold text-accent-sky">
                {listing.categoryName}
              </span>
            )}
            <p className="mt-2 font-mono text-[18px] font-semibold">
              <FormattedPrice amount={listing.price} currency={listing.currency} />
            </p>
            {listing.reason && (
              <Badge tone="teal" className="mt-2">
                {listing.reason}
              </Badge>
            )}
            {!listing.reason && listing.trend && listing.trend.direction !== "flat" && (
              <Badge tone={TREND_TONE[listing.trend.direction]} className="mt-2">
                {TREND_ARROW[listing.trend.direction]} {Math.abs(listing.trend.changePercent)}%
              </Badge>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
