/**
 * Ollama adapter — wraps the self-hosted Llama 3.2 Vision client (lib/ai/llama.ts)
 * to match the shape provider.ts expects from every adapter: a system prompt
 * plus normalized messages in, text (or deltas) plus usage out.
 *
 * Kept separate from llama.ts itself so that file can stay a plain,
 * ladder-agnostic HTTP client instead of knowing about NormalizedMessage or
 * the provider facade.
 *
 * Cost is always $0 — this is a self-hosted model, not a metered API — so
 * usage here tracks call volume, not spend. Ollama's response carries
 * prompt/eval token counts on non-streaming calls only; the streaming path
 * (llamaChatStream) doesn't surface Ollama's final stats line, so streamed
 * calls report zero tokens rather than adding that plumbing for a number
 * nobody bills against.
 */

import { llamaChat, llamaChatStream, LlamaUnavailableError, type ChatMessage } from "./llama";
import type { AiUsage, NormalizedMessage } from "./types";

export { LlamaUnavailableError };

function toChatMessages(system: string, messages: NormalizedMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    const { text, image } = message.content;
    if (!image) {
      out.push({ role: message.role, content: text });
      continue;
    }
    // NormalizedMessage images are already raw base64 (see provider.ts's
    // toAnthropicMessages), matching what Ollama's /api/chat wants.
    out.push({
      role: message.role,
      content: [
        { type: "text", text },
        { type: "image", image: image.data },
      ],
    });
  }
  return out;
}

type OllamaUsage = Omit<AiUsage, "costUsd"> & { costUsd: number | null };

const ZERO_USAGE: OllamaUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

export async function ollamaComplete(params: {
  system: string;
  messages: NormalizedMessage[];
  maxTokens: number;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
}): Promise<{ text: string; usage: OllamaUsage }> {
  const text = await llamaChat({
    messages: toChatMessages(params.system, params.messages),
    format: params.jsonSchema?.schema,
    options: { num_predict: params.maxTokens },
    signal: params.signal,
  });
  return { text, usage: ZERO_USAGE };
}

export async function* ollamaStream(params: {
  system: string;
  messages: NormalizedMessage[];
  maxTokens: number;
  onUsage: (usage: OllamaUsage) => void;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  for await (const delta of llamaChatStream({
    messages: toChatMessages(params.system, params.messages),
    options: { num_predict: params.maxTokens },
    signal: params.signal,
  })) {
    yield delta;
  }
  params.onUsage(ZERO_USAGE);
}
