// Llama 3.2 Vision client — talks to an Ollama-compatible /api/chat endpoint.
//
// Why a hand-rolled fetch client instead of an SDK:
// - We replaced Anthropic on 2026-08-09 to remove the paid-Anthropic dependency
//   for the open-source MVP. The Anthropic SDK is no longer used anywhere in
//   the app (see README 2026-08 session log).
// - Ollama's /api/chat is the only surface that supports both vision images
//   AND a JSON Schema `format` for guaranteed-valid structured output in one
//   place. Its OpenAI-compat /v1/chat/completions surface is marked
//   experimental and does not support either. We hit the native endpoint
//   directly. This keeps the dependency surface to one (built-in fetch).
// - Any other server that speaks /api/chat (vLLM, llama.cpp, etc.) works too;
//   set LLAMA_VISION_BASE_URL to its root.
//
// Configuration (all optional; defaults match an Ollama install with
// `ollama pull llama3.2-vision` already run):
//   LLAMA_VISION_BASE_URL  default http://localhost:11434
//   LLAMA_VISION_MODEL     default llama3.2-vision
//   LLAMA_VISION_API_KEY   default none (Ollama ignores auth by default)

const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2-vision";

function baseUrl(): string {
  // Trim a trailing slash so we can safely append "/api/chat" without //.
  return (process.env.LLAMA_VISION_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function modelName(): string {
  return process.env.LLAMA_VISION_MODEL ?? DEFAULT_MODEL;
}

function authHeaders(): Record<string, string> {
  // Optional — only attached if set, so we never send a junk "Bearer undefined".
  const key = process.env.LLAMA_VISION_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export const RECOMMENDATION_MODEL = modelName();

/* -------------------------------------------------------------------------- */
/* Message shapes                                                             */
/* -------------------------------------------------------------------------- */

// Matches Ollama's chat.completions-style "content" — either a plain string
// or a list of {type, text, image} parts. We use the list form only when an
// image is attached, matching how /api/chat wants multimodal input.
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string /* base64, no data: prefix */ };

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string | ChatContentPart[] };

/* -------------------------------------------------------------------------- */
/* Request body — only the fields we use                                      */
/* -------------------------------------------------------------------------- */

type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  // Ollama's `format` field. Either "json" (any JSON object) or a JSON schema
  // (guaranteed-valid output that matches the schema). We always pass a
  // schema for structured endpoints.
  format?: Record<string, unknown>;
  // Anything Ollama documents under options.* — temperature, num_predict, etc.
  options?: {
    temperature?: number;
    num_predict?: number;
    seed?: number;
  };
  // Keep the model warm across requests so the first user doesn't pay the
  // load cost on every page view. 5m matches Ollama's own default.
  keep_alive?: string;
};

/* -------------------------------------------------------------------------- */
/* Response shape — only the fields we read                                   */
/* -------------------------------------------------------------------------- */

type ChatResponse = {
  model: string;
  message: { role: "assistant"; content: string };
  done: boolean;
  // Present on the final streaming chunk for stats. Not used by callers.
  total_duration?: number;
};

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class LlamaUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LlamaUnavailableError";
  }
}

/* -------------------------------------------------------------------------- */
/* Core: non-streaming chat with optional JSON-schema format                  */
/* -------------------------------------------------------------------------- */

export async function llamaChat(args: {
  messages: ChatMessage[];
  format?: Record<string, unknown>;
  options?: ChatRequest["options"];
  signal?: AbortSignal;
}): Promise<string> {
  const url = `${baseUrl()}/api/chat`;
  const body: ChatRequest = {
    model: modelName(),
    messages: args.messages,
    stream: false,
    keep_alive: "5m",
    ...(args.format ? { format: args.format } : {}),
    ...(args.options ? { options: args.options } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (err) {
    // An abort is the caller's own decision, not the endpoint being down —
    // rethrow it unwrapped so provider.ts doesn't escalate to the next rung.
    if (args.signal?.aborted) throw err;
    throw new LlamaUnavailableError(
      `Could not reach the Llama endpoint at ${url}. Is it running? (LLAMA_VISION_BASE_URL)`,
      err,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlamaUnavailableError(
      `Llama endpoint returned ${res.status}: ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as ChatResponse;
  const content = json.message?.content;
  if (typeof content !== "string") {
    throw new LlamaUnavailableError("Llama response missing message.content");
  }
  return content;
}

/* -------------------------------------------------------------------------- */
/* Streaming chat — yields text deltas as they arrive                         */
/* -------------------------------------------------------------------------- */

// Ollama's streaming response is NDJSON — one JSON object per line, each
// containing a partial message.content. The final line has done: true and
// statistics. We parse line-by-line, yield the assistant text as it grows.
export async function* llamaChatStream(args: {
  messages: ChatMessage[];
  options?: ChatRequest["options"];
  signal?: AbortSignal;
}): AsyncGenerator<string, void, void> {
  const url = `${baseUrl()}/api/chat`;
  const body: ChatRequest = {
    model: modelName(),
    messages: args.messages,
    stream: true,
    keep_alive: "5m",
    ...(args.options ? { options: args.options } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
      signal: args.signal,
    });
  } catch (err) {
    // See llamaChat: an aborted request is the caller stopping, not an outage.
    if (args.signal?.aborted) throw err;
    throw new LlamaUnavailableError(
      `Could not reach the Llama endpoint at ${url}. Is it running?`,
      err,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LlamaUnavailableError(
      `Llama endpoint returned ${res.status}: ${text || res.statusText}`,
    );
  }
  if (!res.body) {
    throw new LlamaUnavailableError("Llama streaming response had no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // The finally is load-bearing: a consumer that stops early (the caller
  // aborted, the client disconnected) runs the generator's `return`, and
  // without this the socket stays open and Ollama keeps generating into it.
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line) as ChatResponse;
          const delta = obj.message?.content;
          if (typeof delta === "string" && delta.length > 0) {
            yield delta;
          }
        } catch {
          // Ignore malformed lines — Ollama should always send valid JSON, but
          // a stray heartbeat shouldn't kill the stream.
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/* -------------------------------------------------------------------------- */
/* Image-content helper                                                       */
/* -------------------------------------------------------------------------- */

// Anthropic's old client took { media_type, data } and we forwarded base64.
// The chat route stores the same shape. Strip the data URL prefix if any
// (Ollama wants raw base64, not "data:image/png;base64,...").
export function base64FromDataUrl(maybeDataUrl: string): string {
  const idx = maybeDataUrl.indexOf(",");
  if (maybeDataUrl.startsWith("data:") && idx >= 0) {
    return maybeDataUrl.slice(idx + 1);
  }
  return maybeDataUrl;
}
