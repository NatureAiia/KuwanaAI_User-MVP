import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { generateAiJson } from "@/lib/ai/provider";
import { computeDecisionScores, CURRENT_DECISION_SCORE_VERSION } from "@/lib/scoring";
import { getListingPriceTrends } from "@/lib/catalog";
import { getListingRequirements, formatRequirement } from "@/lib/eligibility";
import { buildTotalCostSummary } from "@/lib/totalCost";
import { getUserNote } from "@/lib/userNotes";
import { recordEvent } from "@/lib/gamification/process-event";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import {
  getCachedRecommendation,
  isValidRecommendation,
  recommendationCacheKey,
  setCachedRecommendation,
  type CachedRecommendation,
} from "@/lib/recommendationCache";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({
  listingIds: z.array(z.string()).min(2),
  budgetFlexibility: z.enum(["low", "medium", "high"]).optional().nullable(),
  constraints: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
});

// The model only picks listing names (verbatim from the provided set) and
// writes narrative fields — every number on the response (value_score,
// total_cost_summary) is resolved server-side from the DB, so the model
// cannot invent statistics.
const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    primary_option: {
      type: "object",
      properties: {
        listing_name: {
          type: "string",
          description: "The exact `name` field of the single best-fit listing, copied verbatim from the provided list.",
        },
        key_differentiator: {
          type: "string",
          description:
            "One concrete reason this listing wins, grounded in its decision_score, price_trend, requirements, or total_cost fields. One sentence, no invented numbers.",
        },
      },
      required: ["listing_name", "key_differentiator"],
      additionalProperties: false,
    },
    alternative_options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          listing_name: {
            type: "string",
            description: "The exact `name` field of an alternative listing, copied verbatim from the provided list.",
          },
          key_differentiator: {
            type: "string",
            description:
              "One concrete reason someone might still pick it — a specific feature, a lower requirement, fresher data, a better trend, etc. One sentence, no invented numbers.",
          },
        },
        required: ["listing_name", "key_differentiator"],
        additionalProperties: false,
      },
      description: "1-3 real alternatives worth considering, in descending order of fit.",
    },
    explanation: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "2-4 sentence plain-language summary of why the primary option is the best fit, referencing concrete decision_score, price_trend, requirement, or total_cost evidence from the data provided.",
        },
        key_tradeoffs: {
          type: "array",
          items: { type: "string" },
          description:
            "2-4 honest tradeoffs the user should weigh (e.g. cheapest option vs. a minimum balance requirement, a newer unverified provider vs. an established one). Each one sentence.",
        },
        data_traceability_notes: {
          type: "string",
          description:
            "One short sentence stating what data this was based on, when it was last verified (freshness), and that it is AI-assisted. Never assert data not present.",
        },
      },
      required: ["summary", "key_tradeoffs", "data_traceability_notes"],
      additionalProperties: false,
    },
    suggested_action: {
      type: "string",
      description:
        "One concrete next step for the user (e.g. 'Confirm you can meet the US$100 minimum balance before opening', 'Ask the provider whether the current price is a limited-time promotion'). One sentence.",
    },
    confidence: {
      type: "number",
      description: "Confidence in this recommendation given the data available, from 0 to 1.",
    },
  },
  required: ["primary_option", "alternative_options", "explanation", "suggested_action", "confidence"],
  additionalProperties: false,
};

function buildCacheContext(
  budgetFlexibility: string | null | undefined,
  constraints: string[] | undefined,
  noteContent: unknown,
): string {
  const parts: string[] = [];
  if (budgetFlexibility) parts.push(`budget=${budgetFlexibility}`);
  if (constraints?.length) parts.push(`constraints=${[...constraints].sort().join("|")}`);
  // The saved note is per-user, so it must be part of the cache key too —
  // otherwise the first user to hit a given listing/budget/constraint
  // combination would have their notes-shaped recommendation served back to
  // every other user comparing the exact same listings.
  if (noteContent) parts.push(`note=${JSON.stringify(noteContent)}`);
  return parts.join("&");
}

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  // Bills a model on a cache miss. Keyed by user id — the route is
  // authenticated, so identity is known rather than inferred from a
  // spoofable header.
  const limited = await enforceRateLimit(`recommendations:${user.id}`, RATE_LIMITS.authedAi);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { listingIds, budgetFlexibility, constraints } = parsed.data;

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, status: "published" },
    include: { provider: true, category: { include: { attributeSchema: true, sector: true } } },
  });
  if (listings.length < 2) {
    return NextResponse.json({ error: "Need at least 2 listings" }, { status: 400 });
  }

  const category = listings[0].category;

  // Pulls any notes the user previously saved for this sector/category (see
  // the Insurance pre-recommendation intake in CategoryIntakeModal) so the
  // AI has that context automatically, without the client needing to
  // resend it on every call — the same lookup works for any future sector
  // that adopts the same intake pattern.
  const userNote = await getUserNote(user.id, category.sector.slug as Sector, category.slug);

  const listingDTOs: ListingDTO[] = listings.map((l) => ({
    id: l.id,
    name: l.name,
    price: Number(l.price),
    currency: l.currency,
    attributes: l.attributes as Record<string, unknown>,
    freshnessStatus: l.freshnessStatus,
    lastVerifiedAt: l.lastVerifiedAt.toISOString(),
    sourceUrl: l.sourceUrl,
    images: l.images,
    description: l.description ?? null,
    rating: l.rating === null || l.rating === undefined ? null : Number(l.rating),
    reviewCount: l.reviewCount ?? 0,
    provider: l.provider,
  }));
  const attributeSchema: AttributeSchemaFieldDTO[] = category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as AttributeSchemaFieldDTO["dataType"],
    unit: a.unit,
    consumerLabel: a.consumerLabel,
    qualityAxis: a.qualityAxis,
    synonyms: a.synonyms,
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
      total_cost: buildTotalCostSummary(l, attributeSchema),
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

  // Cache keyed on the resolved (published-only) listing set, not the raw
  // request body — two requests differing only in an unpublished/junk ID
  // that gets filtered out below should still hit the same entry. The user's
  // stated budget/constraints change the right answer, so they're folded into
  // the key too (see recommendationCacheKey).
  const cacheKey = recommendationCacheKey(
    listings.map((l) => l.id),
    buildCacheContext(budgetFlexibility, constraints, userNote?.content),
  );
  let result = await getCachedRecommendation(cacheKey);
  if (result && !isValidRecommendation(result)) {
    // A row written under the old schema shape (same key format) — treat it
    // as a miss and regenerate rather than crash on the missing fields.
    console.warn("[recommendations] Ignoring stale cache entry with legacy shape");
    result = null;
  }

  if (!result) {
    const userContext: string[] = [];
    if (budgetFlexibility) {
      userContext.push(
        `Budget flexibility: ${budgetFlexibility}${budgetFlexibility === "low" ? " (price is the deciding factor — cheapest acceptable option)" : budgetFlexibility === "medium" ? " (value-conscious, some room)" : " (price is not the deciding factor)"}`,
      );
    }
    if (constraints?.length) userContext.push(`Stated constraints: ${constraints.join("; ")}`);
    if (userNote?.content && Array.isArray(userNote.content) && userNote.content.length > 0) {
      const noteLines = (userNote.content as { question: string; answer: string }[])
        .map((qa) => `${qa.question} ${qa.answer}`)
        .join("; ");
      userContext.push(`User-provided notes for this category: ${noteLines}`);
    }
    const userContextBlock =
      userContext.length > 0 ? `\nUser context (use to tailor your reasoning — never claim a constraint is met unless the listing data supports it):\n${userContext.join("\n")}` : "";

    // Listings below carry raw attribute key/value pairs only (e.g.
    // `atm_withdrawal_fee: 1`) — without this glossary the model has to guess
    // what a key means and what unit its number is in from the key name alone.
    const attributeGlossaryBlock =
      attributeSchema.length > 0
        ? `\nAttribute glossary (key: label, unit if any) — ${attributeSchema
            .filter((a) => a.key !== "price")
            .map((a) => `${a.key}: ${a.label}${a.unit ? ` (${a.unit})` : ""}`)
            .join("; ")}`
        : "";

    try {
      result = await generateAiJson<CachedRecommendation>({
        feature: "recommendations",
        signals: {
          feature: "recommendations",
          listingCount: listingDTOs.length,
          comparableAttributes: attributeSchema.filter((a) => a.isComparable).length,
          hasPriceTrends: Object.keys(trends).length > 0,
        },
        userId: user.id,
        maxTokens: 1400,
        effort: "low",
        schema: RECOMMENDATION_SCHEMA,
        schemaName: "listing_recommendation",
        system:
          "You are Kuwana's decision-intelligence assistant. You recommend the best-fit option from a small set " +
          "of real listing records for a consumer in Zimbabwe — never the cheapest by default, the best overall fit " +
          "for value and needs. Each listing includes a decision_score breakdown (price_score, benefit_score, " +
          "freshness_adjustment, trend_adjustment, trust_adjustment, total), a price_trend, requirements_to_qualify " +
          "(any upfront balance/deposit or condition needed to access it), and total_cost (recurring or per-use fees). " +
          "Use these as your primary evidence, and reference them concretely in your reasoning rather than restating " +
          "the raw price. Each listing's `attributes` are raw key/value pairs; the prompt's attribute glossary gives " +
          "each key's human label and unit — use it to interpret values correctly instead of guessing from the key " +
          "name alone. Eligibility comes first: if an option carries a requirement the user is unlikely to meet " +
          "(or a materially higher one than its peers), say so explicitly and weigh it honestly in the tradeoffs — " +
          "this is an eligibility signal, not just a spec difference. Only reference data present in the listings " +
          "provided; never invent statistics. Speak in Kuwana's own voice — never refer to yourself as an AI, a " +
          "language model, or mention how this recommendation was produced; just explain the reasoning directly.\n\n" +
          // Restated in prose because this feature is routable to models that
          // treat a JSON schema as advisory rather than enforced.
          'Reply with JSON only, no prose and no markdown fence: {"primary_option": {"listing_name": string, ' +
          '"key_differentiator": string}, "alternative_options": [{"listing_name": string, "key_differentiator": ' +
          'string}], "explanation": {"summary": string, "key_tradeoffs": string[], "data_traceability_notes": ' +
          'string}, "suggested_action": string, "confidence": number between 0 and 1}.',
        prompt: `Category: ${category.name}${attributeGlossaryBlock}${userContextBlock}\n\nListings:\n${JSON.stringify(dataForModel, null, 2)}\n\nRecommend the single best listing, up to 3 worthwhile alternatives, honest tradeoffs, and one concrete next step.`,
      });
    } catch (err) {
      // Previously unhandled — the client would get a bare 500 with no JSON
      // body and silently do nothing (no error shown, no state change, just
      // the button reverting as if nothing happened). 503 signals "the AI
      // service itself is unavailable," distinct from a 400/404 caused by bad
      // input.
      console.error("[recommendations] model request failed:", err);
      return NextResponse.json(
        { error: "AI recommendation is unavailable right now — please try again shortly." },
        { status: 503 },
      );
    }

    if (!result?.explanation) {
      return NextResponse.json({ error: "No recommendation generated" }, { status: 502 });
    }
    await setCachedRecommendation(cacheKey, result);
  }

  const topScoringListing = [...listings].sort(
    (a, b) => (scores[b.id]?.total ?? 0) - (scores[a.id]?.total ?? 0),
  )[0];
  const primary = listings.find((l) => l.name === result.primary_option.listing_name) ?? topScoringListing;
  const primaryDTO = listingDTOs.find((l) => l.id === primary.id)!;

  const alternatives = (result.alternative_options ?? [])
    .map((alt) => {
      const listing = listings.find((l) => l.name === alt.listing_name);
      if (!listing || listing.id === primary.id) return null;
      return {
        listing_id: listing.id,
        provider_name: listing.provider.name,
        listing_title: listing.name,
        key_differentiator: alt.key_differentiator,
        source_url: listing.sourceUrl,
        website_url: listing.provider.websiteUrl,
        last_verified_at: listing.lastVerifiedAt.toISOString(),
      };
    })
    .filter((alt): alt is NonNullable<typeof alt> => alt !== null)
    .slice(0, 3);

  const eligibility_requirements = listingDTOs.map((dto) => ({
    listing_id: dto.id,
    requirements_to_qualify: getListingRequirements(dto, attributeSchema).map(formatRequirement),
  }));

  // Number(): a model that answers "0.8" as a string would otherwise clamp to
  // NaN, which Prisma rejects when writing the Recommendation row.
  const rawConfidence = Number(result.confidence);
  const confidence = Number.isFinite(rawConfidence) ? Math.max(0, Math.min(1, rawConfidence)) : 0;

  const gamification = await prisma.$transaction(
    async (tx) => {
      await tx.recommendation.create({
        data: {
          userId: user.id,
          listingId: primary.id,
          explanation: result.explanation.summary,
          confidence,
          scoreVersion: CURRENT_DECISION_SCORE_VERSION,
        },
      });
      return recordEvent(tx, {
        userId: user.id,
        eventType: "recommendation_viewed",
        sector: category.sector.slug as Sector,
        metadata: { listingId: primary.id },
      });
    },
    { timeout: 15_000 },
  );

  return NextResponse.json({
    recommendation: {
      primary_option: {
        listing_id: primary.id,
        provider_name: primary.provider.name,
        listing_title: primary.name,
        value_score: scores[primary.id]?.total ?? 0,
        total_cost_summary: buildTotalCostSummary(primaryDTO, attributeSchema),
        key_differentiator: result.primary_option.key_differentiator,
        source_url: primary.sourceUrl,
        website_url: primary.provider.websiteUrl,
        last_verified_at: primary.lastVerifiedAt.toISOString(),
      },
      alternative_options: alternatives,
      eligibility_requirements,
      explanation: {
        summary: result.explanation.summary,
        key_tradeoffs: (result.explanation.key_tradeoffs ?? []).slice(0, 4),
        data_traceability_notes: result.explanation.data_traceability_notes,
      },
      suggested_action: result.suggested_action,
      confidence,
    },
    gamification,
  });
}
