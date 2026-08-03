import Link from "next/link";
import { SignalBloom } from "@/components/SignalBloom";
import { Badge } from "@/components/ui/Card";
import type { ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";

export function HeroCarousel({
  title,
  sectorSlug,
  listings,
}: {
  title: string;
  sectorSlug: string;
  listings: (ListingDTO & { score: number; trend?: PriceTrend | null })[];
}) {
  if (listings.length === 0) return null;

  return (
    <section className="mt-2">
      <h2 className="font-display text-[18px] font-semibold">{title}</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listing/${listing.id}?sector=${sectorSlug}`}
            className="w-[220px] shrink-0 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-[14px] font-semibold leading-tight">
                  {listing.name}
                </p>
                <p className="mt-1 text-[11px] text-text-muted">{listing.provider.name}</p>
              </div>
              <SignalBloom value={listing.score} size={44} />
            </div>
            <p className="mt-3 font-mono text-[18px] font-semibold">
              {listing.currency} {listing.price.toFixed(2)}
            </p>
            {listing.trend && listing.trend.direction !== "flat" && (
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
