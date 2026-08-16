import { notFound } from "next/navigation";
import Link from "next/link";
import { Activity, Bot, User, Sprout, type LucideIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getRecentListingActivityGlobal, type GlobalListingActivityEntry } from "@/lib/liveFeed";
import { LiveFeedRefresher } from "@/components/corporate/LiveFeedRefresher";
import { DividedList } from "@/components/corporate/DividedList";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

const SOURCE_ICON: Record<GlobalListingActivityEntry["source"], LucideIcon> = {
  admin: User,
  scraper: Bot,
  corporate: User,
  seed: Sprout,
};

const SOURCE_LABEL: Record<GlobalListingActivityEntry["source"], string> = {
  admin: "Kuwana admin",
  scraper: "Web scraper",
  corporate: "Corporate account",
  seed: "Initial data",
};

export default async function AdminLiveFeedPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const activity = await getRecentListingActivityGlobal();

  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 md:px-10">
      <LiveFeedRefresher />
      <div className="flex items-center gap-1.5">
        <Activity size={16} className="text-accent-sky" strokeWidth={2.25} />
        <h1 className="font-display text-[24px] font-bold">Live feed</h1>
      </div>
      <p className="mt-1 text-[13px] text-text-secondary">
        Every recent change to any provider&apos;s listings, platform-wide — refreshes automatically every 20
        seconds. Distinct from the audit log, which only covers admin-authored actions.
      </p>

      <DividedList
        className="mt-6"
        items={activity}
        keyFor={(entry) => entry.id}
        itemClassName="flex items-start gap-2.5"
        emptyMessage={
          <EmptyState
            variant="inline"
            icon={Activity}
            title="No listing activity yet"
            description="Listing creates, edits, and price changes from every provider, scraper run, and admin action will appear here as they happen."
          />
        }
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
                  {entry.providerName} · {SOURCE_LABEL[entry.source]} · {formatDateTime(entry.createdAt)}
                </p>
              </div>
            </>
          );
        }}
      />
    </div>
  );
}
