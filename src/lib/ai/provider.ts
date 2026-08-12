/**
 * The one place the app asks a model for something.
 *
 * Three responsibilities: choose which model to use, translate the call into
 * that provider's shape, and record what it cost.
 *
 * Model choice is tiered (see lib/ai/tiers.ts). A complexity score computed
 * from signals the caller already has picks the starting rung of a
 * cheapest-first ladder, and a rung that fails hands off to the next one up.
 * Most calls therefore land on a free model and never cost anything; the
 * expensive model is reached only by work that earns it.
 *
 * Routes call `generateAiJson` / `streamAiText` and never touch a provider SDK,
 * which is what makes all of this changeable without touching a route.
 */

import { anthropic } from "./anthropic";
import { openRouterComplete, openRouterStream } from "./openrouter";
import { ollamaComplete, ollamaStream } from "./ollama";
import { resolveLadder } from "./modelConfig";
import { estimateCostUsd, type AiFeature, type ModelSpec } from "./models";
import { planTiers, scoreComplexity, type ComplexitySignals } from "./tiers";
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
 * Only reached when every rung of the ladder is text-only and the user still
 * attached an image. Dropping the image and saying so beats failing the turn
 * or pretending nothing was attached — the reply then explains the limit.
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

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function planFor(feature: AiFeature, signals: ComplexitySignals, requireVision?: boolean) {
  const ladder = await resolveLadder(feature);
  const complexity = scoreComplexity(signals);
  return planTiers({ ladder, complexity, requireVision });
}

export async function generateAiJson<T>(params: {
  feature: AiFeature;
  signals: ComplexitySignals;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxTokens: number;
  effort?: Effort;
  userId?: string;
}): Promise<T> {
  const plan = await planFor(params.feature, params.signals, false);
  const messages: NormalizedMessage[] = [{ role: "user", content: params.prompt }];

  let lastError: unknown = new Error("No model available for this feature");

  for (const [offset, model] of plan.candidates.entries()) {
    const startedAt = Date.now();
    const previous = offset > 0 ? plan.candidates[offset - 1].id : null;

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
      } else if (model.provider === "ollama") {
        const result = await ollamaComplete({
          system: params.system,
          messages,
          maxTokens: params.maxTokens,
          jsonSchema: { name: params.schemaName, schema: params.schema },
        });
        text = result.text;
        inputTokens = result.usage.inputTokens;
        outputTokens = result.usage.outputTokens;
        costUsd = result.usage.costUsd;
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
      // Parsing sits inside the try on purpose: unparseable output from a weak
      // model is exactly the case escalation exists for, and it is the failure
      // mode a JSON schema does not actually prevent on every provider.
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
        attempt: offset + 1,
        escalatedFrom: previous,
        complexity: plan.complexity,
      });

      return parsed;
    } catch (err) {
      lastError = err;
      await recordUsage({
        model,
        feature: params.feature,
        userId: params.userId,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
        ok: false,
        errorMessage: messageOf(err),
        attempt: offset + 1,
        escalatedFrom: previous,
        complexity: plan.complexity,
      });

      const next = plan.candidates[offset + 1];
      if (next) {
        console.warn(
          `[ai] ${params.feature}: ${model.id} failed (${messageOf(err)}), escalating to ${next.id}`,
        );
      }
    }
  }

  throw lastError;
}

/**
 * Streams text deltas, escalating on failure.
 *
 * Escalation is only possible until the first delta is handed to the caller —
 * after that the user is already reading a reply, and restarting on another
 * model would either duplicate or contradict what they have seen. So a rung
 * that fails mid-stream fails the whole call, while one that fails before
 * producing anything hands off cleanly to the next rung.
 */
export async function* streamAiText(params: {
  feature: AiFeature;
  signals: ComplexitySignals;
  system: string;
  messages: NormalizedMessage[];
  maxTokens: number;
  userId?: string;
}): AsyncGenerator<string> {
  const hasImage = params.messages.some(
    (m) => typeof m.content !== "string" && Boolean(m.content.image),
  );
  const plan = await planFor(params.feature, params.signals, hasImage);

  let lastError: unknown = new Error("No model available for this feature");

  for (const [offset, model] of plan.candidates.entries()) {
    const startedAt = Date.now();
    const previous = offset > 0 ? plan.candidates[offset - 1].id : null;
    const messages = stripImagesFor(model, params.messages);

    let inputTokens = 0;
    let outputTokens = 0;
    let reportedCost: number | null = null;
    let errorMessage: string | null = null;
    let emitted = false;

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
            emitted = true;
            yield event.delta.text;
          }
        }
      } else if (model.provider === "ollama") {
        const stream = ollamaStream({
          system: params.system,
          messages,
          maxTokens: params.maxTokens,
          onUsage: (usage) => {
            inputTokens = usage.inputTokens;
            outputTokens = usage.outputTokens;
            reportedCost = usage.costUsd;
          },
        });
        for await (const delta of stream) {
          emitted = true;
          yield delta;
        }
      } else {
        const stream = openRouterStream({
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
        for await (const delta of stream) {
          emitted = true;
          yield delta;
        }
      }

      // A rung that returns cleanly but says nothing is a failure the caller
      // cannot use — treat it like an error so the next rung gets a turn.
      if (!emitted) throw new Error("Model produced no output");
    } catch (err) {
      errorMessage = messageOf(err);
      lastError = err;
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
        attempt: offset + 1,
        escalatedFrom: previous,
        complexity: plan.complexity,
      });
    }

    if (errorMessage === null) return;

    // Past the point of no return: the caller already has text on screen.
    if (emitted) throw lastError;

    const next = plan.candidates[offset + 1];
    if (next) {
      console.warn(
        `[ai] ${params.feature}: ${model.id} failed before output (${errorMessage}), escalating to ${next.id}`,
      );
    }
  }

  throw lastError;
}
