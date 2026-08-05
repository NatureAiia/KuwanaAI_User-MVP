import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { anthropic, RECOMMENDATION_MODEL } from "@/lib/ai/anthropic";
import { computeDecisionScores, CURRENT_DECISION_SCORE_VERSION } from "@/lib/scoring";
import { getListingPriceTrends } from "@/lib/catalog";
import { getListingRequirements, formatRequirement } from "@/lib/eligibility";
import { recordEvent } from "@/lib/gamification/process-event";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({
  // Capped at 10 — each listing is serialized into the prompt, so an
  // uncapped array lets one authenticated request drive an arbitrarily
  // large (and arbitrarily expensive) model call.
  listingIds: z.array(z.string()).min(2).max(10),
});

const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    recommended_listing_name: {
      type: "string",
      description: "The exact `name` field of the listing being recommended, copied verbatim.",
    },
    explanation: {
      type: "string",
      description:
        "Plain-language explanation of why this listing is the best fit, 2-4 sentences, written for a Zimbabwean consumer comparing these options. Never invent numbers not present in the data.",
    },
    confidence: {
      type: "number",
      description: "Confidence in this recommendation, from 0 to 1.",
    },
  },
  required: ["recommended_listing_name", "explanation", "confidence"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  // Every call here is a billed Claude request. Keyed on the user id rather
  // than the IP: the caller is authenticated, so this cannot be sidestepped
  // by rotating a forwarded-for header.
  const limited = await enforceRateLimit(`recommendations:${user.id}`, RATE_LIMITS.authedAi);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { listingIds } = parsed.data;

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, status: "published" },
    include: { provider: true, category: { include: { attributeSchema: true, sector: true } } },
  });
  if (listings.length < 2) {
    return NextResponse.json({ error: "Need at least 2 listings" }, { status: 400 });
  }

  const category = listings[0].category;
  const listingDTOs: ListingDTO[] = listings.map((l) => ({
    id: l.id,
    name: l.name,
    price: Number(l.price),
    currency: l.currency,
    attributes: l.attributes as Record<string, unknown>,
    freshnessStatus: l.freshnessStatus,
    lastVerifiedAt: l.lastVerifiedAt.toISOString(),
    sourceUrl: l.sourceUrl,
    provider: l.provider,
  }));
  const attributeSchema: AttributeSchemaFieldDTO[] = category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as AttributeSchemaFieldDTO["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));
  const trends = await getListingPriceTrends(listingIds);
  const scores = computeDecisionScores(listingDTOs, attributeSchema, trends);

  const dataForModel = listingDTOs.map((l) => {
    const trend = trends[l.id];
    const score = scores[l.id];
    const requirements = getListingRequirements(l, attributeSchema).map(formatRequirement);
    return {
      name: l.name,
      provider: l.provider.name,
      provider_verified: l.provider.verified,
      price: l.price,
      currency: l.currency,
      attributes: l.attributes,
      requirements_to_qualify: requirements.length > 0 ? requirements : "none stated",
      freshness: l.freshnessStatus,
      decision_score: score && {
        total: score.total,
        price_score: score.priceScore,
        benefit_score: score.benefitScore,
        freshness_adjustment: score.freshnessAdjustment,
        trend_adjustment: score.trendAdjustment,
        trust_adjustment: score.trustAdjustment,
      },
      price_trend: trend
        ? { direction: trend.direction, change_percent: trend.changePercent, period_days: trend.periodDays }
        : null,
    };
  });

  const message = await anthropic.messages.create({
    model: RECOMMENDATION_MODEL,
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: RECOMMENDATION_SCHEMA },
    },
    system:
      "You are Kuwana's comparison assistant. You recommend the best-fit option from a small set " +
      "of real listing records for a consumer in Zimbabwe — never the cheapest by default, the best " +
      "overall fit for value and needs. Each listing includes a decision_score breakdown " +
      "(price_score, benefit_score, freshness_adjustment, trend_adjustment, trust_adjustment, total), " +
      "a price_trend, and requirements_to_qualify (any upfront balance/deposit or condition needed to " +
      "access it) — use these as your primary evidence, and reference them concretely in your " +
      "explanation (e.g. its price trend, freshness, provider trust, or a requirement that rules it " +
      "out for someone who can't meet it) rather than restating the raw price. If one option has a " +
      "materially higher requirement than the others, say so explicitly — this is an eligibility " +
      "signal, not just a spec difference. Only reference data present in the listings provided; " +
      "never invent statistics. Always make clear this is an AI-assisted recommendation.",
    messages: [
      {
        role: "user",
        content: `Category: ${category.name}\n\nListings:\n${JSON.stringify(dataForModel, null, 2)}\n\nRecommend the single best listing for a typical consumer and explain why.`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No recommendation generated" }, { status: 502 });
  }
  const result = JSON.parse(textBlock.text) as {
    recommended_listing_name: string;
    explanation: string;
    confidence: number;
  };

  const recommendedListing =
    listings.find((l) => l.name === result.recommended_listing_name) ?? listings[0];

  const confidence = Math.max(0, Math.min(1, result.confidence));

  const gamification = await prisma.$transaction(
    async (tx) => {
      await tx.recommendation.create({
        data: {
          userId: user.id,
          listingId: recommendedListing.id,
          explanation: result.explanation,
          confidence,
          scoreVersion: CURRENT_DECISION_SCORE_VERSION,
        },
      });
      return recordEvent(tx, {
        userId: user.id,
        eventType: "recommendation_viewed",
        sector: category.sector.slug as Sector,
        metadata: { listingId: recommendedListing.id },
      });
    },
    { timeout: 15_000 },
  );

  return privateJson({
    listingId: recommendedListing.id,
    explanation: result.explanation,
    confidence,
    gamification,
  });
}
