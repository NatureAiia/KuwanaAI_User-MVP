/**
 * The one place the app asks a model for something.
 *
 * Two responsibilities: pick the provider for the feature's currently selected
 * model and translate the call into that provider's shape, and record every
 * call — success or failure — into llm_usage so /admin/llm has something to
 * report. Routes call `generateAiJson` / `streamAiText` and never touch a
 * provider SDK directly, which is what makes the model switchable at runtime.
 */

import { anthropic } from "./anthropic";
import { openRouterComplete, openRouterStream } from "./openrouter";
import { resolveModel } from "./modelConfig";
import { estimateCostUsd, type AiFeature, type ModelSpec } from "./models";
import { recordUsage } from "./usage";
import type { NormalizedMessage } from "./types";

/** Anthropic's effort levels; OpenRouter has no equivalent and ignores it. */
type Effort = "low" | "medium" | "high";

function toAnthropicMessages(messages: NormalizedMessage[]) {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { role: message.role, content: message.content };
    }
    const { text, image } = message.content;
    if (!image) return { role: message.role, content: text };
    return {
      role: message.role,
      content: [
        {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: image.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: image.data,
          },
        },
        { type: "text" as const, text },
      ],
    };
  });
}

/**
 * Models that can't take an image still have to answer the turn. Dropping the
 * image and telling the model so is better than either failing the request or
 * silently pretending the user attached nothing — the reply then explains the
 * limitation instead of confusing the user.
 */
function stripImagesFor(model: ModelSpec, messages: NormalizedMessage[]): NormalizedMessage[] {
  if (model.vision) return messages;
  return messages.map((message) => {
    if (typeof message.content === "string" || !message.content.image) return message;
    return {
      role: message.role,
      content: `${message.content.text}\n\n[The user attached an image, but the current model cannot read images. Say so plainly and answer the text part.]`,
    };
  });
}

/** Some models wrap JSON in a markdown fence despite a schema being requested. */
function unfence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

export async function generateAiJson<T>(params: {
  feature: AiFeature;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
  effort?: Effort;
  userId?: string;
}): Promise<T> {
  const model = await resolveModel(params.feature);
  const startedAt = Date.now();
  const messages: NormalizedMessage[] = [{ role: "user", content: params.prompt }];

  try {
    let text: string;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd: number | null = null;

    if (model.provider === "anthropic") {
      const message = await anthropic.messages.create({
        model: model.id,
        max_tokens: params.maxTokens,
        output_config: {
          effort: params.effort ?? "low",
          format: { type: "json_schema", schema: params.schema },
        },
        system: params.system,
        messages: toAnthropicMessages(messages),
      });
      const block = message.content.find((b) => b.type === "text");
      text = block && block.type === "text" ? block.text : "";
      inputTokens = message.usage.input_tokens;
      outputTokens = message.usage.output_tokens;
    } else {
      // The schema is also restated in the system prompt by the callers, so a
      // model that ignores response_format still has a chance of complying.
      const result = await openRouterComplete({
        model: model.id,
        system: params.system,
        messages,
        maxTokens: params.maxTokens,
        jsonSchema: { name: params.schemaName, schema: params.schema },
      });
      text = result.text;
      inputTokens = result.usage.inputTokens;
      outputTokens = result.usage.outputTokens;
      costUsd = result.usage.costUsd;
    }

    if (!text.trim()) throw new Error("Model returned an empty response");
    const parsed = JSON.parse(unfence(text)) as T;

    await recordUsage({
      model,
      feature: params.feature,
      userId: params.userId,
      inputTokens,
      outputTokens,
      costUsd: costUsd ?? estimateCostUsd(model, inputTokens, outputTokens),
      latencyMs: Date.now() - startedAt,
      ok: true,
    });

    return parsed;
  } catch (err) {
    await recordUsage({
      model,
      feature: params.feature,
      userId: params.userId,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Yields text deltas and records usage when the stream ends, including when it
 * ends by throwing — the `finally` is what guarantees a failed generation still
 * shows up on the cost page rather than vanishing.
 */
export async function* streamAiText(params: {
  feature: AiFeature;
  system: string;
  messages: NormalizedMessage[];
  maxTokens: number;
  userId?: string;
}): AsyncGenerator<string> {
  const model = await resolveModel(params.feature);
  const startedAt = Date.now();
  const messages = stripImagesFor(model, params.messages);

  let inputTokens = 0;
  let outputTokens = 0;
  let reportedCost: number | null = null;
  let errorMessage: string | null = null;

  try {
    if (model.provider === "anthropic") {
      const stream = anthropic.messages.stream({
        model: model.id,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: toAnthropicMessages(messages),
      });
      for await (const event of stream) {
        if (event.type === "message_start") {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === "message_delta") {
          outputTokens = event.usage.output_tokens;
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    } else {
      yield* openRouterStream({
        model: model.id,
        system: params.system,
        messages,
        maxTokens: params.maxTokens,
        onUsage: (usage) => {
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;
          reportedCost = usage.costUsd;
        },
      });
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    await recordUsage({
      model,
      feature: params.feature,
      userId: params.userId,
      inputTokens,
      outputTokens,
      costUsd: reportedCost ?? estimateCostUsd(model, inputTokens, outputTokens),
      latencyMs: Date.now() - startedAt,
      ok: errorMessage === null,
      errorMessage: errorMessage ?? undefined,
    });
  }
}
