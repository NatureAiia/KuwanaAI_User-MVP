/**
 * Turns a scraped page into a candidate listing, via the same tiered LLM
 * ladder every other AI feature uses (see lib/ai/provider.ts) — nothing here
 * calls a provider SDK directly. The result is never written to Listing
 * itself; it lands in ScrapedItem for an admin to review (see
 * /admin/scraper and api/admin/scraped-items).
 */
import { generateAiJson } from "@/lib/ai/provider";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

export type ExtractedCandidate = {
  name: string;
  price: number | null;
  currency: string | null;
  description: string | null;
  provider_name_guess: string | null;
  attributes: Record<string, unknown>;
};

type ModelResponse = ExtractedCandidate & { confidence: number };

function buildSchema(attributeSchema: AttributeSchemaFieldDTO[]) {
  const attributeProps: Record<string, unknown> = {};
  for (const field of attributeSchema) {
    attributeProps[field.key] = {
      type: [field.dataType === "number" ? "number" : field.dataType === "boolean" ? "boolean" : "string", "null"],
      description: `${field.label}${field.unit ? ` (${field.unit})` : ""}`,
    };
  }

  return {
    type: "object",
    properties: {
      name: { type: "string", description: "The product/plan/service's own name, exactly as the page states it." },
      price: { type: ["number", "null"], description: "The numeric price, or null if no price is stated." },
      currency: { type: ["string", "null"], description: "The currency code as stated, e.g. USD, ZiG, ZAR." },
      description: { type: ["string", "null"], description: "One short sentence describing what this is." },
      provider_name_guess: {
        type: ["string", "null"],
        description: "The company/provider this belongs to, as named on the page.",
      },
      attributes: {
        type: "object",
        properties: attributeProps,
        description: "Only the fields below that the page actually states a value for; leave the rest null.",
      },
      confidence: {
        type: "number",
        description: "0 to 1: how confident this is a single, correctly-extracted priced listing.",
      },
    },
    required: ["name", "price", "currency", "description", "provider_name_guess", "attributes", "confidence"],
    additionalProperties: false,
  };
}

const SYSTEM_PROMPT =
  "You extract exactly one priced product/plan/service listing from a scraped web page for a " +
  "Zimbabwean price-comparison app. Only extract what the page actually states — never invent a " +
  "price, provider name, or attribute value that isn't there. If the page describes several " +
  "priced items, pick the single clearest one and lower confidence accordingly. If nothing on the " +
  "page resembles a priced listing, still return your best-guess name with confidence near 0 rather " +
  "than failing.\n\n" +
  // Restated in prose for models that treat a JSON schema as advisory.
  'Reply with JSON only, no prose and no markdown fence: {"name": string, "price": number|null, ' +
  '"currency": string|null, "description": string|null, "provider_name_guess": string|null, ' +
  '"attributes": object, "confidence": number between 0 and 1}.';

export async function extractListingCandidate(params: {
  markdown: string;
  sourceUrl: string;
  attributeSchema: AttributeSchemaFieldDTO[];
}): Promise<{ data: ExtractedCandidate; confidence: number }> {
  // Keeps the prompt (and its cost) bounded — a tariff/product page rarely
  // needs more than this to identify one priced item.
  const truncated = params.markdown.slice(0, 12_000);

  const result = await generateAiJson<ModelResponse>({
    feature: "scrape_extract",
    signals: {
      feature: "scrape_extract",
      contentLength: truncated.length,
      attributeCount: params.attributeSchema.length,
    },
    system: SYSTEM_PROMPT,
    prompt: `Source URL: ${params.sourceUrl}\n\nPage content (markdown):\n${truncated}`,
    schema: buildSchema(params.attributeSchema),
    schemaName: "scraped_listing_candidate",
    maxTokens: 1024,
    effort: "low",
  });

  const confidence = Number(result.confidence);
  return {
    data: {
      name: result.name,
      price: result.price,
      currency: result.currency,
      description: result.description,
      provider_name_guess: result.provider_name_guess,
      attributes: result.attributes,
    },
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
  };
}
