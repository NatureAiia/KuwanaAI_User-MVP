import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, RECOMMENDATION_MODEL } from "@/lib/ai/anthropic";
import { getSectorCategories } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";

// Deliberately no auth check — /explore itself is intentionally public for
// pre-signup browsing (see proxy.ts), and this is just a faster way into
// the same read-only pages, not a consumer-identity action.
//
// That combination — unauthenticated, and a billed Claude call on every
// request — made this the cheapest way to run up the project's Anthropic
// bill from a laptop. It is rate limited per client below. See
// lib/rateLimit.ts for why a per-instance limiter is a real but partial
// mitigation on a serverless deploy.
const bodySchema = z.object({ query: z.string().trim().min(1).max(300) });

const INTAKE_SCHEMA = {
  type: "object",
  properties: {
    sector_slug: {
      type: ["string", "null"],
      description: "The single best-matching sector slug from the provided list, or null if nothing matches.",
    },
    category_slug: {
      type: ["string", "null"],
      description: "The single best-matching category slug within that sector, or null if unclear.",
    },
    confidence: { type: "number", description: "0 to 1, how confident this match is." },
  },
  required: ["sector_slug", "category_slug", "confidence"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`need-intake:${clientKey(req)}`, RATE_LIMITS.publicAi);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const sectorsWithCategories = await Promise.all(
    LIVE_SECTORS.map(async (slug) => ({
      slug,
      name: SECTORS[slug].name,
      categories: await getSectorCategories(slug),
    })),
  );

  const catalogForModel = sectorsWithCategories.map((s) => ({
    sector_slug: s.slug,
    sector_name: s.name,
    categories: s.categories.map((c) => ({ category_slug: c.slug, category_name: c.name })),
  }));

  const message = await anthropic.messages.create({
    model: RECOMMENDATION_MODEL,
    max_tokens: 300,
    output_config: { effort: "low", format: { type: "json_schema", schema: INTAKE_SCHEMA } },
    system:
      "You route a Zimbabwean consumer's plain-language need to the single best-matching sector and " +
      "category from a closed list — never invent a slug not present in the list. If nothing plausibly " +
      "matches, return null for both. A vague need like \"I need internet\" should still map to the " +
      "closest live sector/category (telecom data bundles) even if imperfect, as long as it's a " +
      "reasonable interpretation — only return null when the need is genuinely unrelated to anything " +
      "in the list (e.g. a general question, or a sector Kuwana doesn't cover).",
    messages: [
      {
        role: "user",
        content: `Available sectors and categories:\n${JSON.stringify(catalogForModel, null, 2)}\n\nUser's need: "${parsed.data.query}"`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return privateJson({ sectorSlug: null, categorySlug: null, confidence: 0 });
  }

  const result = JSON.parse(textBlock.text) as {
    sector_slug: string | null;
    category_slug: string | null;
    confidence: number;
  };

  // Never trust the model's slugs blindly — validate against the same closed list it was given.
  const matchedSector = sectorsWithCategories.find((s) => s.slug === result.sector_slug);
  const matchedCategory = matchedSector?.categories.find((c) => c.slug === result.category_slug);

  return privateJson({
    sectorSlug: matchedSector?.slug ?? null,
    categorySlug: matchedCategory?.slug ?? null,
    confidence: Math.max(0, Math.min(1, result.confidence)),
  });
}
