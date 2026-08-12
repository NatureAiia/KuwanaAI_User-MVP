/**
 * The catalog of models an admin may select from, and what each one costs.
 *
 * Prices are USD per single token (not per million) so the cost arithmetic in
 * provider.ts never has to remember which unit it is in. They are the list
 * prices at the time of writing — OpenRouter reports the real cost per call
 * and we prefer that number when present, so these entries are the fallback
 * for Anthropic (whose API returns tokens, not dollars) and for the rare
 * OpenRouter response that omits cost.
 */

export type AiProvider = "anthropic" | "openrouter";

/** Every distinct place the app calls a model. One selectable model each. */
export const AI_FEATURES = ["chat", "recommendations", "intake"] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  chat: "Assistant chat",
  recommendations: "Compare recommendation",
  intake: "Need-intake routing",
};

export const AI_FEATURE_BLURBS: Record<AiFeature, string> = {
  chat: "Streaming replies in /chat. The only feature that accepts image input.",
  recommendations: "Structured pick-the-best-listing output on the compare screen.",
  intake: "Cheap, high-volume classifier routing a plain-language need to a sector/category.",
};

export type ModelSpec = {
  id: string;
  provider: AiProvider;
  label: string;
  /** USD per input token. */
  inputPrice: number;
  /** USD per output token. */
  outputPrice: number;
  contextWindow: number;
  /** Whether the model accepts image blocks — chat is the only feature that sends them. */
  vision: boolean;
  note?: string;
};

/**
 * Ordered cheapest-first within each provider so the admin picker reads as a
 * cost ladder rather than an arbitrary list.
 */
export const MODEL_CATALOG: ModelSpec[] = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    provider: "openrouter",
    label: "Nemotron 3 Super 120B (free)",
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 262_144,
    vision: false,
    note: "Free tier — shared queue, so latency is unpredictable (measured 69s for a 30-token call) and the daily request cap is low. No image support.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    provider: "openrouter",
    label: "Nemotron 3 Super 120B",
    inputPrice: 0.000_000_085,
    outputPrice: 0.000_000_4,
    contextWindow: 1_000_000,
    vision: false,
    note: "Paid tier of the same model — no free-tier queue or daily cap. Needs OpenRouter credits; the account returns 402 without them.",
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    provider: "openrouter",
    label: "Nemotron 3 Nano 30B",
    inputPrice: 0.000_000_05,
    outputPrice: 0.000_000_2,
    contextWindow: 262_144,
    vision: false,
    note: "Cheapest paid option. Needs OpenRouter credits; the account returns 402 without them.",
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5",
    inputPrice: 0.000_001,
    outputPrice: 0.000_005,
    contextWindow: 200_000,
    vision: true,
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    inputPrice: 0.000_003,
    outputPrice: 0.000_015,
    contextWindow: 1_000_000,
    vision: true,
  },
  {
    id: "claude-opus-5",
    provider: "anthropic",
    label: "Claude Opus 5",
    inputPrice: 0.000_005,
    outputPrice: 0.000_025,
    contextWindow: 1_000_000,
    vision: true,
  },
];

const BY_ID = new Map(MODEL_CATALOG.map((m) => [m.id, m]));

export function findModel(id: string): ModelSpec | undefined {
  return BY_ID.get(id);
}

/**
 * What each feature uses when no admin override is stored. Chat defaults to a
 * vision-capable model because it is the one feature that can receive an
 * image; the other two are text-only and default to the free model.
 */
export const DEFAULT_MODELS: Record<AiFeature, string> = {
  chat: "claude-opus-5",
  recommendations: "nvidia/nemotron-3-super-120b-a12b:free",
  intake: "nvidia/nemotron-3-super-120b-a12b:free",
};

/** Cost of one call in USD, from token counts. Used when the provider doesn't report a cost. */
export function estimateCostUsd(model: ModelSpec, inputTokens: number, outputTokens: number): number {
  return inputTokens * model.inputPrice + outputTokens * model.outputPrice;
}

export function isAiFeature(value: string): value is AiFeature {
  return (AI_FEATURES as readonly string[]).includes(value);
}
