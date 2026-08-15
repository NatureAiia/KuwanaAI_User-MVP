import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/Card";
import { MentionReviewButton } from "@/components/admin/MentionReviewButton";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { ensureSentimentComputed } from "@/lib/sentiment";
import type { ExtractedPrice } from "@/lib/social-scan/extractPrices";

const SENTIMENT_TONE = { positive: "teal", negative: "coral", neutral: "neutral" } as const;

export default async function SocialMentionsPage({
  searchParams,
}: {
  searchParams: Promise<{ reviewed?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { reviewed: reviewedParam } = await searchParams;
  const showReviewed = reviewedParam === "true";

  await ensureSentimentComputed({ reviewed: showReviewed });

  const mentions = await prisma.socialPriceMention.findMany({
    where: { reviewed: showReviewed },
    orderBy: { discoveredAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Social price mentions</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Public posts from the free social scanner (Reddit, Telegram) that mention a price.
        Intelligence only — nothing here updates listings automatically.
      </p>

      <div className="mt-5 flex gap-2">
        <Link
          href="/admin/social-mentions"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !showReviewed
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border text-text-secondary"
          }`}
        >
          Unreviewed
        </Link>
        <Link
          href="/admin/social-mentions?reviewed=true"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            showReviewed
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border text-text-secondary"
          }`}
        >
          Reviewed
        </Link>
      </div>

      <div className="mt-5">
      <SearchableSection placeholder="Search mentions…">
      <div className="space-y-3">
        {mentions.length === 0 && (
          <p className="text-[13px] text-text-muted">
            {showReviewed ? "Nothing reviewed yet." : "No unreviewed mentions — run npm run scan:social."}
          </p>
        )}

        {mentions.map((mention) => {
          const prices = Array.isArray(mention.extractedPrices)
            ? (mention.extractedPrices as unknown as ExtractedPrice[])
            : [];

          return (
            <div
              key={mention.id}
              data-search-row
              className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{mention.platform}</Badge>
                <span className="text-[12px] text-text-muted">{mention.channel}</span>
                {mention.matchedProvider && <Badge tone="teal">{mention.matchedProvider}</Badge>}
                {mention.sentiment && <Badge tone={SENTIMENT_TONE[mention.sentiment]}>{mention.sentiment}</Badge>}
                {prices.map((p, i) => (
                  <Badge key={i} tone="sky">
                    {p.currency} {p.amount}
                  </Badge>
                ))}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.5] text-text-secondary">
                {mention.text}
              </p>

              <div className="mt-3 flex items-center justify-between">
                <a
                  href={mention.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-sky hover:underline"
                >
                  <ExternalLink size={13} />
                  View source
                </a>
                {!showReviewed && <MentionReviewButton id={mention.id} />}
              </div>
            </div>
          );
        })}
      </div>
      </SearchableSection>
      </div>
    </div>
  );
}
