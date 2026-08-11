"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, Pin } from "lucide-react";
import { ProviderLogo } from "@/components/ProviderLogo";
import { FormattedPrice } from "@/components/FormattedPrice";
import type { RecentlyViewedListing } from "@/lib/catalog";

// No decision score shown here (unlike HeroCarousel) — a score is meaningful
// only in the context of a specific comparison, not a standalone "you looked
// at this" row, and fabricating one would be exactly the kind of invented
// number this project avoids.
export function RecentlyViewedRow({ items: initialItems }: { items: RecentlyViewedListing[] }) {
  const [items, setItems] = useState(initialItems);

  // Optimistic pin toggle: flip the flag + move a freshly-pinned listing to
  // the front of the row immediately, then reconcile with the server. A
  // failed request snaps the row back to its previous state.
  function togglePin(listingId: string, pinned: boolean) {
    let snapshot: RecentlyViewedListing[] = [];
    setItems((prev) => {
      snapshot = prev;
      const next = prev.map((i) => (i.listing.id === listingId ? { ...i, pinned: !pinned } : i));
      if (!pinned) {
        const item = next.find((i) => i.listing.id === listingId);
        if (item) return [item, ...next.filter((i) => i.listing.id !== listingId)];
      }
      return next;
    });
    void fetch("/api/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, pinned: !pinned }),
    })
      .then((res) => {
        if (!res.ok) setItems(snapshot);
      })
      .catch(() => setItems(snapshot));
  }

  if (items.length === 0) {
    // First-time visitors get a placeholder tile instead of nothing — the
    // section is still a signal that history lives here, it just has nothing
    // to show yet.
    return (
      <section className="mt-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-semibold">Pick up where you left off</h2>
          <Link
            href="/history"
            className="tap-target flex shrink-0 items-center rounded-full text-[13px] font-semibold text-accent-sky hover:text-accent-teal"
          >
            View all
          </Link>
        </div>
        <Link
          href="/explore"
          className="mt-3 flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border bg-bg-surface p-5 transition-colors hover:border-accent-sky/50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-teal/10 text-accent-teal">
            <Compass size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[14px] font-semibold text-text-primary">Let&apos;s start exploring</p>
            <p className="mt-0.5 text-[12px] text-text-muted">
              Products you open will show up here so you can pick up right where you stopped.
            </p>
          </div>
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-[18px] font-semibold">Pick up where you left off</h2>
        <Link
          href="/history"
          className="tap-target flex shrink-0 items-center rounded-full text-[13px] font-semibold text-accent-sky hover:text-accent-teal"
        >
          View all
        </Link>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
        {items.map(({ listing, pinned }) => (
          <div
            key={listing.id}
            className="relative w-[200px] shrink-0 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4"
          >
            <Link href={`/listing/${listing.id}`} className="block">
              <div className="flex items-center gap-2">
                <ProviderLogo name={listing.provider.name} logoUrl={listing.provider.logoUrl} size={28} />
                <p className="truncate font-display text-[14px] font-semibold leading-tight">
                  {listing.name}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-text-muted">{listing.provider.name}</p>
              <p className="mt-3 font-mono text-[16px] font-semibold">
                <FormattedPrice amount={listing.price} currency={listing.currency} />
              </p>
            </Link>
            <button
              type="button"
              onClick={() => togglePin(listing.id, pinned)}
              aria-pressed={pinned}
              aria-label={pinned ? `Unpin ${listing.name}` : `Pin ${listing.name} to the top`}
              title={pinned ? "Unpin" : "Keep at the top"}
              className="tap-target absolute right-2.5 top-2.5 rounded-full p-1.5 text-text-muted transition-colors hover:bg-bg-surface-raised hover:text-accent-teal"
            >
              <Pin size={14} fill={pinned ? "currentColor" : "none"} className={pinned ? "text-accent-teal" : ""} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
