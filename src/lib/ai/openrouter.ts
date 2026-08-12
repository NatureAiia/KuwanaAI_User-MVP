/**
 * OpenRouter adapter.
 *
 * OpenRouter speaks the OpenAI chat-completions wire format, which is a
 * different shape from the Anthropic SDK the rest of this app uses — so this
 * file is deliberately a separate adapter rather than an attempt to point the
 * Anthropic client at a different base URL (that cannot work; the request and
 * response bodies do not match). provider.ts is the seam that hides the
 * difference from callers.
 *
 * Written against `fetch` rather than pulling in the `openai` package: we use
 * exactly two endpoints' worth of surface, and a second SDK for one adapter is
 * more dependency than the code it saves.
 */

import type { AiUsage, NormalizedMessage } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenAiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenAiContentPart[];
};

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
}

/**
 * Sent on every request. OpenRouter attributes usage on its dashboard by these
 * two headers, so leaving them off makes per-app spend impossible to read
 * there — which is the whole point of the cost page this feeds.
 */
function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    "X-Title": "Kuwana",
  };
}

/** Anthropic's system+messages split maps onto a leading system message here. */
function toOpenAiMessages(system: string, messages: NormalizedMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    const parts: OpenAiContentPart[] = [];
    if (message.content.image) {
      // OpenAI-format image input is a data: URI in an image_url part, not a
      // separate base64 source object as in the Anthropic format.
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${message.content.image.mediaType};base64,${message.content.image.data}`,
        },
      });
    }
    parts.push({ type: "text", text: message.content.text });
    out.push({ role: message.role, content: parts });
  }
  return out;
}

type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
};

/**
 * `cost` is only present because every request sets `usage: {include: true}`.
 * Prefer it over our own price table when it is there: it is what OpenRouter
 * actually charged, including any per-model promo or routing surcharge our
 * static table cannot know about.
 */
function readUsage(raw: OpenRouterUsage | undefined): Omit<AiUsage, "costUsd"> & { costUsd: number | null } {
  return {
    inputTokens: raw?.prompt_tokens ?? 0,
    outputTokens: raw?.completion_tokens ?? 0,
    costUsd: typeof raw?.cost === "number" ? raw.cost : null,
  };
}

async function failure(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 300)}`);
}

/**
 * OpenRouter's `:free` tiers are a shared queue, and a queued request can sit
 * for over a minute before the model even starts — measured at 69s for a
 * 30-token classification, and four sequential calls failing to finish inside
 * five minutes. Every call site here is in a user's request path, so without a
 * deadline a busy free tier doesn't degrade the feature, it hangs the request
 * until the platform kills it.
 *
 * Both callers already handle a thrown error (intake falls back to "no match",
 * recommendations returns 503), so failing fast is strictly better than
 * waiting. Tunable via OPENROUTER_TIMEOUT_MS for a deployment that would
 * rather wait than fall back.
 */
const DEFAULT_TIMEOUT_MS = 30_000;

function timeoutMs(): number {
  const configured = Number(process.env.OPENROUTER_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * Runs `fetch` under a deadline. For a streaming call the deadline covers
 * time-to-first-byte only — `fetch` resolves once the response headers land,
 * so clearing the timer there lets a long generation keep streaming while
 * still capping the wait for a queued request that never starts.
 */
async function fetchWithDeadline(body: string, callerSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  callerSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, timeoutMs());

  try {
    return await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: headers(),
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error(`OpenRouter timed out after ${timeoutMs()}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", abort);
  }
}

export async function openRouterComplete(params: {
  model: string;
  system: string;
  messages: NormalizedMessage[];
  maxTokens: number;
  /** When set, asks for a schema-constrained JSON response. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}): Promise<{ text: string; usage: ReturnType<typeof readUsage> }> {
  const response = await fetchWithDeadline(
    JSON.stringify({
      model: params.model,
      messages: toOpenAiMessages(params.system, params.messages),
      max_tokens: params.maxTokens,
      usage: { include: true },
      ...(params.jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: params.jsonSchema.name, strict: true, schema: params.jsonSchema.schema },
            },
          }
        : {}),
    }),
    params.signal,
  );

  if (!response.ok) await failure(response);

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: OpenRouterUsage;
    error?: { message?: string };
  };

  if (payload.error) throw new Error(`OpenRouter: ${payload.error.message ?? "unknown error"}`);

  return {
    text: payload.choices?.[0]?.message?.content ?? "",
    usage: readUsage(payload.usage),
  };
}

/**
 * Streams text deltas. The final SSE frame carries the usage totals — the
 * caller gets them via `onUsage` rather than a return value, because a
 * generator's return value is awkward to reach through `for await`.
 */
export async function* openRouterStream(params: {
  model: string;
  system: string;
  messages: NormalizedMessage[];
  maxTokens: number;
  onUsage: (usage: ReturnType<typeof readUsage>) => void;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const response = await fetchWithDeadline(
    JSON.stringify({
      model: params.model,
      messages: toOpenAiMessages(params.system, params.messages),
      max_tokens: params.maxTokens,
      stream: true,
      usage: { include: true },
    }),
    params.signal,
  );

  if (!response.ok) await failure(response);
  if (!response.body) throw new Error("OpenRouter returned no response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are newline-delimited; the trailing partial line stays in the
      // buffer until the chunk that completes it arrives.
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        // OpenRouter sends `: OPENROUTER PROCESSING` comment lines as
        // keep-alives while a slow model warms up. They are not JSON.
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (data === "[DONE]") return;

        let frame: {
          choices?: { delta?: { content?: string | null } }[];
          usage?: OpenRouterUsage;
          error?: { message?: string };
        };
        try {
          frame = JSON.parse(data);
        } catch {
          continue;
        }

        if (frame.error) throw new Error(`OpenRouter: ${frame.error.message ?? "stream error"}`);
        // Usage rides the final frame, which usually has an empty choices array.
        if (frame.usage) params.onUsage(readUsage(frame.usage));

        const delta = frame.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
