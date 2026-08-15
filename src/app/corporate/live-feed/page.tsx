import Link from "next/link";
import { Activity, Bot, User, Sprout, type LucideIcon } from "lucide-react";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { getRecentListingActivity, type ListingActivityEntry } from "@/lib/liveFeed";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { LiveFeedRefresher } from "@/components/corporate/LiveFeedRefresher";
import { DividedList } from "@/components/corporate/DividedList";
import { formatDateTime } from "@/lib/format";

const SOURCE_ICON: Record<ListingActivityEntry["source"], LucideIcon> = {
  admin: User,
  scraper: Bot,
  corporate: User,
  seed: Sprout,
};

const SOURCE_LABEL: Record<ListingActivityEntry["source"], string> = {
  admin: "Kuwana admin",
  scraper: "Web scraper",
  corporate: "You",
  seed: "Initial data",
};

export default async function CorporateLiveFeedPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const activity = await getRecentListingActivity(provider.id);

  return (
    <div>
      <LiveFeedRefresher />
      <div className="flex items-center gap-1.5">
        <Activity size={16} className="text-accent-sky" strokeWidth={2.25} />
        <h1 className="font-display text-[20px] font-bold">Live feed</h1>
      </div>
      <p className="mt-1 text-[13px] text-text-secondary">
        Every recent change to your listings — refreshes automatically every 20 seconds.
      </p>

      <DividedList
        className="mt-6"
        items={activity}
        keyFor={(entry) => entry.id}
        itemClassName="flex items-start gap-2.5"
        emptyMessage="No activity on your listings yet."
        renderItem={(entry) => {
          const Icon = SOURCE_ICON[entry.source];
          return (
            <>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-surface-raised text-text-secondary">
                <Icon size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/listing/${entry.listingId}`} className="text-[13.5px] font-medium hover:text-accent-sky">
                  {entry.listingName}
                </Link>
                <p className="text-[12.5px] text-text-secondary">{entry.changeSummary}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {SOURCE_LABEL[entry.source]} · {formatDateTime(entry.createdAt)}
                </p>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
