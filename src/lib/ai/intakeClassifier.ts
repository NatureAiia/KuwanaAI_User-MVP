import { generateAiJson } from "@/lib/ai/provider";
import { getSectorCategories } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";

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

const SYSTEM_PROMPT =
  "You route a Zimbabwean consumer's plain-language need to the single best-matching sector and " +
  "category from a closed list — never invent a slug not present in the list. If nothing plausibly " +
  "matches, return null for both. A vague need like \"I need internet\" should still map to the " +
  "closest live sector/category (telecom data bundles) even if imperfect, as long as it's a " +
  "reasonable interpretation — only return null when the need is genuinely unrelated to anything " +
  "in the list (e.g. a general question, or a sector Kuwana doesn't cover).\n\n" +
  // Restated in prose because this feature is routable to models that treat a
  // JSON schema as advisory rather than enforced.
  'Reply with JSON only, no prose and no markdown fence: {"sector_slug": string|null, ' +
  '"category_slug": string|null, "confidence": number between 0 and 1}.';

export type IntakeResult = { sectorSlug: string | null; categorySlug: string | null; confidence: number };

export async function classifyIntake(query: string): Promise<IntakeResult> {
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

  let result: { sector_slug: string | null; category_slug: string | null; confidence: number };
  try {
    result = await generateAiJson({
      feature: "intake",
      system: SYSTEM_PROMPT,
      prompt: `Available sectors and categories:\n${JSON.stringify(catalogForModel, null, 2)}\n\nUser's need: "${query}"`,
      schema: INTAKE_SCHEMA,
      schemaName: "intake_route",
      maxTokens: 300,
      effort: "low",
    });
  } catch (err) {
    // Routing is a nice-to-have on top of the search the caller does anyway —
    // "no confident match" is a usable answer, an exception is not.
    console.error("[intake] classification failed:", err);
    return { sectorSlug: null, categorySlug: null, confidence: 0 };
  }

  // Never trust the model's slugs blindly — validate against the same closed list it was given.
  const matchedSector = sectorsWithCategories.find((s) => s.slug === result.sector_slug);
  const matchedCategory = matchedSector?.categories.find((c) => c.slug === result.category_slug);

  // Number(): a model that answers "0.8" as a string would otherwise clamp to
  // NaN and render as an empty confidence badge.
  const confidence = Number(result.confidence);

  return {
    sectorSlug: matchedSector?.slug ?? null,
    categorySlug: matchedCategory?.slug ?? null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
  };
}
