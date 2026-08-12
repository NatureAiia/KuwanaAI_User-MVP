import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client, used only by lib/ai/provider.ts. Call sites go through
 * that facade instead so the model — and the provider behind it — stays
 * switchable from /admin/llm at runtime.
 */
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
