import Link from "next/link";
import { Flame } from "lucide-react";
import { FormattedPrice } from "@/components/FormattedPrice";
import type { TrendingListing } from "@/lib/catalog";

// The comparisonCount badge is a real tally over the last 7 days of
// Comparison rows (see getTrendingListings) — never a placeholder number.
export function TrendingRow({ items }: { items: TrendingListing[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="flex items-center gap-1.5 font-display text-[16px] font-semibold">
        <Flame size={16} className="text-accent-coral" />
        Trending this week
      </h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {items.map(({ listing, comparisonCount }) => (
          <Link
            key={listing.id}
            href={`/listing/${listing.id}`}
            className="w-[200px] shrink-0 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4"
          >
            <p className="font-display text-[14px] font-semibold leading-tight">{listing.name}</p>
            <p className="mt-1 text-[11px] text-text-muted">{listing.provider.name}</p>
            <p className="mt-3 font-mono text-[16px] font-semibold">
              <FormattedPrice amount={listing.price} currency={listing.currency} />
            </p>
            <p className="mt-1.5 text-[11px] text-accent-coral">
              {comparisonCount} comparison{comparisonCount === 1 ? "" : "s"} this week
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
