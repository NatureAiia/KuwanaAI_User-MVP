import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FormattedPrice } from "@/components/FormattedPrice";
import type { ChatListingSummary } from "@/components/chat/MessageBubble";

export function ChatListingPreview({ listings }: { listings: ChatListingSummary[] }) {
  if (listings.length === 0) return null;

  const compareHref =
    listings.length >= 2
      ? `/explore/${listings[0].sectorSlug}/compare?category=${listings[0].categoryId}&ids=${listings.map((l) => l.id).join(",")}`
      : `/listing/${listings[0].id}?sector=${listings[0].sectorSlug}`;

  return (
    <div className="ml-8 mt-1.5 flex max-w-[78%] flex-col gap-1.5">
      {listings.map((l) => (
        <div
          key={l.id}
          className="flex items-center justify-between rounded-xl border border-border bg-bg-surface px-3 py-2 text-[12px]"
        >
          <div>
            <p className="font-medium text-text-primary">{l.name}</p>
            <p className="text-text-muted">{l.provider}</p>
          </div>
          <p className="font-mono font-semibold text-text-primary">
            <FormattedPrice amount={l.price} currency={l.currency} />
          </p>
        </div>
      ))}
      <Link
        href={compareHref}
        className="tap-target inline-flex items-center gap-1 self-start rounded-full border border-accent-sky/40 px-3 py-1.5 text-[11.5px] font-semibold text-accent-sky"
      >
        {listings.length >= 2 ? "Open comparison" : "View details"}
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}
