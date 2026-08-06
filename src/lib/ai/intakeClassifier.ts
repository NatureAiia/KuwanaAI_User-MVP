import { anthropic, RECOMMENDATION_MODEL } from "@/lib/ai/anthropic";
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
  "You route a Zimbabwean consumer's need — described in plain language or shown in a photo of a " +
  "product/item — to the single best-matching sector and category from a closed list — never invent a " +
  "slug not present in the list. If nothing plausibly matches, return null for both. A vague need like " +
  "\"I need internet\" should still map to the closest live sector/category (telecom data bundles) even " +
  "if imperfect, as long as it's a reasonable interpretation — only return null when the need is " +
  "genuinely unrelated to anything in the list (e.g. a general question, a photo of something Kuwana " +
  "doesn't sell, or a sector Kuwana doesn't cover).";

export type IntakeResult = { sectorSlug: string | null; categorySlug: string | null; confidence: number };

type Base64Image = { mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };

/** Shared by the text ("what do you need?") and photo intake routes — same catalog, schema, and validation either way. */
export async function classifyIntake(input: { text: string } | { image: Base64Image }): Promise<IntakeResult> {
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
  const catalogText = `Available sectors and categories:\n${JSON.stringify(catalogForModel, null, 2)}\n\n`;

  const content =
    "text" in input
      ? `${catalogText}User's need: "${input.text}"`
      : ([
          {
            type: "text" as const,
            text: `${catalogText}The user submitted a photo of a product or item. Identify what it most likely is and route it to the best-matching sector and category from the list above.`,
          },
          {
            type: "image" as const,
            source: { type: "base64" as const, media_type: input.image.mediaType, data: input.image.data },
          },
        ]);

  const message = await anthropic.messages.create({
    model: RECOMMENDATION_MODEL,
    max_tokens: 300,
    output_config: { effort: "low", format: { type: "json_schema", schema: INTAKE_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { sectorSlug: null, categorySlug: null, confidence: 0 };
  }

  const result = JSON.parse(textBlock.text) as {
    sector_slug: string | null;
    category_slug: string | null;
    confidence: number;
  };

  // Never trust the model's slugs blindly — validate against the same closed list it was given.
  const matchedSector = sectorsWithCategories.find((s) => s.slug === result.sector_slug);
  const matchedCategory = matchedSector?.categories.find((c) => c.slug === result.category_slug);

  return {
    sectorSlug: matchedSector?.slug ?? null,
    categorySlug: matchedCategory?.slug ?? null,
    confidence: Math.max(0, Math.min(1, result.confidence)),
  };
}
