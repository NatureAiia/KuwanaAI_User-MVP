import { llamaChat } from "@/lib/ai/llama";
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
    budget_flexibility: {
      type: ["string", "null"],
      description:
        "How much the price matters to the user, from their own words: 'low' (price is the deciding factor — they want the cheapest acceptable option), 'medium' (value-conscious with some room), 'high' (price is not the deciding factor). null if they didn't say anything about budget.",
    },
    constraints: {
      type: ["array", "null"],
      items: { type: "string" },
      description:
        "Up to 3 concrete requirements or constraints the user stated (e.g. 'EcoCash payment', 'no bank account needed', 'works in Harare', 'unlimited data'). Concise noun phrases, or null if none.",
    },
  },
  required: ["sector_slug", "category_slug", "confidence", "budget_flexibility", "constraints"],
  additionalProperties: false,
};

const SYSTEM_PROMPT =
  "You route a Zimbabwean consumer's plain-language need to the single best-matching sector and " +
  "category from a closed list — never invent a slug not present in the list. If nothing plausibly " +
  "matches, return null for both. A vague need like \"I need internet\" should still map to the " +
  "closest live sector/category (telecom data bundles) even if imperfect, as long as it's a " +
  "reasonable interpretation — only return null when the need is genuinely unrelated to anything " +
  "in the list (e.g. a general question, or a sector Kuwana doesn't cover).\n" +
  "Also capture the user's budget flexibility and any concrete constraints from their words — but " +
  "only what they actually said; don't infer a budget stance or constraints that aren't expressed. " +
  "Distill constraints to short, standalone noun phrases (never full sentences).";

export type IntakeResult = {
  sectorSlug: string | null;
  categorySlug: string | null;
  confidence: number;
  budgetFlexibility: "low" | "medium" | "high" | null;
  constraints: string[];
};

const BUDGET_FLEXIBILITY = new Set(["low", "medium", "high"]);

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

  const content = await llamaChat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Available sectors and categories:\n${JSON.stringify(catalogForModel, null, 2)}\n\nUser's need: "${query}"`,
      },
    ],
    // Ollama guarantees the response is a JSON object matching this schema.
    format: INTAKE_SCHEMA,
    options: { temperature: 0, num_predict: 400 },
  });

  const result = JSON.parse(content) as {
    sector_slug: string | null;
    category_slug: string | null;
    confidence: number;
    budget_flexibility: string | null;
    constraints: string[] | null;
  };

  // Never trust the model's slugs blindly — validate against the same closed list it was given.
  const matchedSector = sectorsWithCategories.find((s) => s.slug === result.sector_slug);
  const matchedCategory = matchedSector?.categories.find((c) => c.slug === result.category_slug);

  return {
    sectorSlug: matchedSector?.slug ?? null,
    categorySlug: matchedCategory?.slug ?? null,
    confidence: Math.max(0, Math.min(1, result.confidence)),
    budgetFlexibility:
      typeof result.budget_flexibility === "string" && BUDGET_FLEXIBILITY.has(result.budget_flexibility)
        ? (result.budget_flexibility as "low" | "medium" | "high")
        : null,
    constraints: Array.isArray(result.constraints)
      ? result.constraints
          .map((c) => String(c).trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((c) => c.slice(0, 80))
      : [],
  };
}
