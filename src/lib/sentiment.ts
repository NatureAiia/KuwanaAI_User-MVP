import type { Prisma, SentimentLabel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAiJson } from "@/lib/ai/provider";

const BATCH_SIZE = 20;
const LABELS: SentimentLabel[] = ["positive", "negative", "neutral"];

const SENTIMENT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "number" },
          sentiment: { type: "string", enum: LABELS },
        },
        required: ["index", "sentiment"],
      },
    },
  },
  required: ["results"],
};

/**
 * Classifies sentiment for any SocialPriceMention rows matching `where` that
 * haven't been classified yet (sentiment: null), capped at `limit`. Same
 * "compute on read, persist" shape as syncPriceDropNotifications and
 * friends — called from wherever mentions are displayed, not from the
 * scanner script, so scripts/social-scan stays free of an AI-provider
 * dependency.
 */
export async function ensureSentimentComputed(
  where: Prisma.SocialPriceMentionWhereInput,
  limit = 60,
): Promise<void> {
  const pending = await prisma.socialPriceMention.findMany({
    where: { ...where, sentiment: null },
    select: { id: true, text: true },
    take: limit,
  });
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    try {
      const result = await generateAiJson<{ results: { index: number; sentiment: string }[] }>({
        feature: "sentiment_analysis",
        signals: { feature: "sentiment_analysis", batchSize: batch.length },
        system:
          "Classify the overall sentiment of each numbered social media post toward the price, provider, or " +
          "product/service it discusses — positive, negative, or neutral. Respond with exactly one result per post.",
        prompt: batch.map((m, idx) => `${idx}: ${m.text.slice(0, 500)}`).join("\n\n"),
        schema: SENTIMENT_SCHEMA,
        schemaName: "sentiment_batch",
        maxTokens: 40 * batch.length,
      });

      const isLabel = (value: string): value is SentimentLabel => (LABELS as string[]).includes(value);
      await Promise.all(
        result.results
          .filter((r) => isLabel(r.sentiment) && batch[r.index])
          .map((r) =>
            prisma.socialPriceMention.update({
              where: { id: batch[r.index].id },
              data: { sentiment: r.sentiment as SentimentLabel },
            }),
          ),
      );
    } catch (err) {
      // A classification miss just leaves those rows unclassified for the
      // next read to retry — never blocks the page that triggered this.
      console.error("[sentiment] batch classification failed:", err);
    }
  }
}

export type SentimentSummary = {
  positive: number;
  negative: number;
  neutral: number;
  unclassified: number;
  total: number;
  positiveShare: number | null;
};

export async function getSentimentSummary(where: Prisma.SocialPriceMentionWhereInput): Promise<SentimentSummary> {
  const grouped = await prisma.socialPriceMention.groupBy({
    by: ["sentiment"],
    where,
    _count: { _all: true },
  });

  const byLabel = new Map(grouped.map((g) => [g.sentiment, g._count._all]));
  const positive = byLabel.get("positive") ?? 0;
  const negative = byLabel.get("negative") ?? 0;
  const neutral = byLabel.get("neutral") ?? 0;
  const unclassified = byLabel.get(null) ?? 0;
  const classified = positive + negative + neutral;

  return {
    positive,
    negative,
    neutral,
    unclassified,
    total: classified + unclassified,
    positiveShare: classified > 0 ? positive / classified : null,
  };
}
