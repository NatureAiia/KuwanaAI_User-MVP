import Link from "next/link";
import { FormattedPrice } from "@/components/FormattedPrice";
import type { RecentlyViewedListing } from "@/lib/catalog";

// No decision score shown here (unlike HeroCarousel) — a score is meaningful
// only in the context of a specific comparison, not a standalone "you looked
// at this" row, and fabricating one would be exactly the kind of invented
// number this project avoids.
export function RecentlyViewedRow({ items }: { items: RecentlyViewedListing[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-2">
      <h2 className="font-display text-[18px] font-semibold">Pick up where you left off</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {items.map(({ listing }) => (
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
          </Link>
        ))}
      </div>
    </section>
  );
}
