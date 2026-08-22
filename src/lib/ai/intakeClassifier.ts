import { generateAiJson } from "@/lib/ai/provider";
import { getSectorCategories } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";

/** Shared by classifyIntake() and resolveChatIntent() — the closed sector/category list both route free text against. */
async function loadSectorCatalog() {
  return Promise.all(
    LIVE_SECTORS.map(async (slug) => ({
      slug,
      name: SECTORS[slug].name,
      categories: await getSectorCategories(slug),
    })),
  );
}

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
  "Distill constraints to short, standalone noun phrases (never full sentences).\n\n" +
  // Restated in prose because this feature is routable to models that treat a
  // JSON schema as advisory rather than enforced.
  'Reply with JSON only, no prose and no markdown fence: {"sector_slug": string|null, ' +
  '"category_slug": string|null, "confidence": number between 0 and 1, "budget_flexibility": ' +
  '"low"|"medium"|"high"|null, "constraints": string[]|null}.';

export type IntakeResult = {
  sectorSlug: string | null;
  categorySlug: string | null;
  confidence: number;
  budgetFlexibility: "low" | "medium" | "high" | null;
  constraints: string[];
};

const BUDGET_FLEXIBILITY = new Set(["low", "medium", "high"]);

export async function classifyIntake(query: string): Promise<IntakeResult> {
  const sectorsWithCategories = await loadSectorCatalog();

  const catalogForModel = sectorsWithCategories.map((s) => ({
    sector_slug: s.slug,
    sector_name: s.name,
    categories: s.categories.map((c) => ({ category_slug: c.slug, category_name: c.name })),
  }));

  let result: {
    sector_slug: string | null;
    category_slug: string | null;
    confidence: number;
    budget_flexibility: string | null;
    constraints: string[] | null;
  };
  try {
    result = await generateAiJson({
      feature: "intake",
      signals: { feature: "intake", query },
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
    return { sectorSlug: null, categorySlug: null, confidence: 0, budgetFlexibility: null, constraints: [] };
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

// ---------------------------------------------------------------------------
// Chat intent resolution — the "Context Router" from the uploaded 7-sector
// docs, adapted onto this app's chat surface. Runs on the same cheap
// `intake` tier as classifyIntake() above; the caller (/api/chat) only
// invokes this for a consumer's fresh free-text question with no
// listingIds already attached — a follow-up about already-selected
// listings skips straight to the normal grounded-answer path.
// ---------------------------------------------------------------------------

const CHAT_INTENT_SCHEMA = {
  type: "object",
  properties: {
    sector_slug: { type: ["string", "null"], description: "Best-matching sector slug from the provided list, or null." },
    category_slug: { type: ["string", "null"], description: "Best-matching category slug within that sector, or null." },
    confidence: { type: "number", description: "0 to 1." },
    // Flow 3 (Product vs Product via Prompt) — populated only when the user
    // named 2-5 specific things to compare (a provider, product, or brand
    // name), e.g. "Compare CBZ vs FBC" or "NetOne vs Econet 1GB bundles".
    // Never invented — only names actually present in the question.
    entity_names: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
      description:
        "2-5 provider/product names the user explicitly named to compare against each other, in their own words. Empty array if the question doesn't name specific things to compare (e.g. it's a general 'what's cheapest' question).",
    },
    // A closed list keeps this genuinely resolvable server-side (bounded
    // count, no free-form field name the client has to render blind).
    missing_context: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          field: { type: "string", description: "Short internal key for this piece of context, e.g. 'province', 'budget', 'customer_type'." },
          question: { type: "string", description: "The follow-up question to show the user, in plain everyday language." },
          options: {
            type: ["array", "null"],
            items: { type: "string" },
            description: "Up to 4 short quick-reply options if there's an obvious closed set (e.g. provinces); null for free text.",
          },
        },
        required: ["field", "question", "options"],
        additionalProperties: false,
      },
      description:
        "Up to 3 follow-up questions for whatever's missing to give a grounded, specific answer instead of a generic one. Empty array if the question already has enough to proceed.",
    },
  },
  required: ["sector_slug", "category_slug", "confidence", "entity_names", "missing_context"],
  additionalProperties: false,
};

const CHAT_INTENT_SYSTEM_PROMPT =
  "You route a Zimbabwean consumer's plain-language comparison question to the single best-matching sector and " +
  "category from a closed list, the same way an intake classifier would — never invent a slug not present in the " +
  "list.\n\n" +
  "If the question names 2-5 specific providers/products to compare against each other (e.g. \"Compare CBZ vs FBC\", " +
  "\"NetOne vs Econet 1GB\"), capture those names verbatim in entity_names — otherwise leave it empty.\n\n" +
  "Then decide if the question already has enough specifics to give a grounded, specific answer (province/city, " +
  "budget or price ceiling, customer type, a named provider or two, a concrete need like data amount or account " +
  "type) — if so, leave missing_context empty. If it's too generic to answer well (e.g. \"what's the cheapest data " +
  "bundle\" with no province or usage need, or \"best bank\" with no idea what for), populate missing_context with " +
  "up to 3 short, concrete follow-up questions that would actually narrow the answer — never ask something that " +
  "doesn't change the outcome. Give quick-reply options when there's an obvious small closed set (e.g. province: " +
  "Harare/Bulawayo/Gweru/Mutare), otherwise leave options null for free text. Prefer resolving with 1 question over " +
  "3 when one genuinely covers it. A question that already names specific things to compare (entity_names non-empty) " +
  "rarely needs more clarification.\n\n" +
  'Reply with JSON only, no prose and no markdown fence: {"sector_slug": string|null, "category_slug": ' +
  'string|null, "confidence": number, "entity_names": string[], "missing_context": [{"field": string, "question": ' +
  'string, "options": string[]|null}]}.';

export type ChatIntentResult = {
  sectorSlug: string | null;
  categorySlug: string | null;
  confidence: number;
  entityNames: string[];
  missingContext: { field: string; question: string; options: string[] | null }[];
};

export async function resolveChatIntent(query: string): Promise<ChatIntentResult> {
  const sectorsWithCategories = await loadSectorCatalog();
  const catalogForModel = sectorsWithCategories.map((s) => ({
    sector_slug: s.slug,
    sector_name: s.name,
    categories: s.categories.map((c) => ({ category_slug: c.slug, category_name: c.name })),
  }));

  let result: {
    sector_slug: string | null;
    category_slug: string | null;
    confidence: number;
    entity_names: string[];
    missing_context: { field: string; question: string; options: string[] | null }[];
  };
  try {
    result = await generateAiJson({
      feature: "intake",
      signals: { feature: "intake", query },
      system: CHAT_INTENT_SYSTEM_PROMPT,
      prompt: `Available sectors and categories:\n${JSON.stringify(catalogForModel, null, 2)}\n\nUser's question: "${query}"`,
      schema: CHAT_INTENT_SCHEMA,
      schemaName: "chat_intent_route",
      maxTokens: 400,
      effort: "low",
    });
  } catch (err) {
    // A failed clarification check must never block the chat — fall through
    // to "resolvable" so the caller proceeds with today's ungated answer.
    console.error("[chat-intent] resolution failed:", err);
    return { sectorSlug: null, categorySlug: null, confidence: 0, entityNames: [], missingContext: [] };
  }

  const matchedSector = sectorsWithCategories.find((s) => s.slug === result.sector_slug);
  const matchedCategory = matchedSector?.categories.find((c) => c.slug === result.category_slug);
  const confidence = Number(result.confidence);

  return {
    sectorSlug: matchedSector?.slug ?? null,
    categorySlug: matchedCategory?.slug ?? null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    entityNames: Array.isArray(result.entity_names)
      ? result.entity_names.map((n) => String(n).trim()).filter(Boolean).slice(0, 5).map((n) => n.slice(0, 60))
      : [],
    missingContext: Array.isArray(result.missing_context)
      ? result.missing_context
          .slice(0, 3)
          .filter((m) => m && typeof m.field === "string" && typeof m.question === "string")
          .map((m) => ({
            field: m.field.slice(0, 40),
            question: m.question.slice(0, 200),
            options: Array.isArray(m.options) ? m.options.map((o) => String(o).slice(0, 40)).slice(0, 4) : null,
          }))
      : [],
  };
}
