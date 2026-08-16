import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getRecentlyViewedDetailed } from "@/lib/catalog";
import { Header } from "@/components/Header";
import { BottomTabBar } from "@/components/BottomTabBar";
import { FormattedPrice } from "@/components/FormattedPrice";
import { BackButton } from "@/components/ui/BackButton";

export const metadata: Metadata = {
  title: "Your history — Kuwana",
};

export default async function HistoryPage() {
  const user = await requireUser();
  if (!user) return null;

  const items = await getRecentlyViewedDetailed(user.id, 100);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center gap-2">
        <BackButton />
        <Clock size={20} className="text-accent-teal" />
        <h1 className="font-display text-[24px] font-bold">Your history</h1>
      </div>
      <p className="mt-1 text-[13px] text-text-secondary">
        Everything you&apos;ve looked at, across every category.
      </p>

      {items.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-6 text-center">
          <p className="text-[14px] text-text-secondary">Nothing here yet.</p>
          <p className="mt-1 text-[13px] text-text-muted">
            Open some listings from Explore and they&apos;ll show up here.
          </p>
          <Link
            href="/explore"
            className="tap-target mt-4 inline-flex items-center rounded-full bg-accent-sky px-5 py-2 text-[13px] font-semibold text-white"
          >
            Start exploring
          </Link>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {items.map(({ listing, category, viewedAt }) => (
            <li key={listing.id}>
              <Link
                href={`/listing/${listing.id}`}
                className="block rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 transition-shadow hover:shadow-[0_0_24px_-10px_var(--accent-teal)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-[15px] font-semibold">
                      {listing.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-muted">{listing.provider.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-accent-teal/10 px-2 py-0.5 text-[10.5px] font-medium text-accent-teal">
                        {category.sector.name}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-text-secondary">
                        {category.name}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[16px] font-semibold">
                      <FormattedPrice amount={listing.price} currency={listing.currency} />
                    </p>
                    <p className="mt-1 text-[11px] text-text-muted">
                      {new Date(viewedAt).toLocaleDateString("en-ZW", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BottomTabBar />
    </div>
  );
}
