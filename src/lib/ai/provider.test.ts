import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Abort semantics for the model ladder.
 *
 * The ladder escalates a failing rung to the next, more expensive one. That is
 * correct for a model that errored, and exactly wrong for a caller that
 * withdrew the request: answering "stop spending" by retrying on a costlier
 * model is the opposite of what the abort was for. `/api/chat` aborts on client
 * disconnect and on its wall-clock timeout, so this is the hot path for it.
 */

const openRouterStreamMock = vi.fn();
const openRouterCompleteMock = vi.fn();
const anthropicStreamMock = vi.fn();
const anthropicCreateMock = vi.fn();
const recordUsageMock = vi.fn(async () => {});

let ladder: string[] = [];

vi.mock("./openrouter", () => ({
  openRouterStream: (params: unknown) => openRouterStreamMock(params),
  openRouterComplete: (params: unknown) => openRouterCompleteMock(params),
}));

vi.mock("./ollama", () => ({
  ollamaStream: vi.fn(),
  ollamaComplete: vi.fn(),
}));

vi.mock("./anthropic", () => ({
  anthropic: {
    messages: {
      stream: (...args: unknown[]) => anthropicStreamMock(...args),
      create: (...args: unknown[]) => anthropicCreateMock(...args),
    },
  },
}));

vi.mock("./modelConfig", () => ({
  resolveLadder: async () => ladder,
}));

vi.mock("./usage", () => ({
  recordUsage: (...args: unknown[]) => recordUsageMock(...(args as [])),
}));

const { streamAiText, generateAiJson } = await import("./provider");

/**
 * Two real OpenRouter rungs from MODEL_CATALOG, so every candidate takes the
 * openRouterStream path. Ids not in the catalog are silently dropped by
 * planTiers and fall through to the Anthropic last resort, which would test
 * the wrong branch.
 */
const TWO_RUNG_LADDER = ["nvidia/nemotron-3-super-120b-a12b:free", "nvidia/nemotron-3-nano-30b-a3b"];

const SIGNALS = {
  feature: "chat" as const,
  hasImage: false,
  turnCount: 0,
  messageLength: 10,
  groundedListings: 0,
};

const JSON_SIGNALS = {
  feature: "recommendations" as const,
  listingCount: 2,
  comparableAttributes: 2,
  hasPriceTrends: false,
};

beforeEach(() => {
  openRouterStreamMock.mockReset();
  openRouterCompleteMock.mockReset();
  anthropicStreamMock.mockReset();
  anthropicCreateMock.mockReset();
  recordUsageMock.mockClear();
  ladder = TWO_RUNG_LADDER;
});

async function* yieldThenAbort(controller: AbortController, chunks: string[]) {
  for (const chunk of chunks) yield chunk;
  controller.abort();
  throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
}

async function drain(stream: AsyncGenerator<string>): Promise<{ text: string; error: unknown }> {
  let text = "";
  try {
    for await (const delta of stream) text += delta;
    return { text, error: null };
  } catch (error) {
    return { text, error };
  }
}

describe("streamAiText abort handling", () => {
  it("passes the caller's signal down to the provider", async () => {
    const controller = new AbortController();
    openRouterStreamMock.mockImplementation(async function* () {
      yield "hi";
    });

    await drain(
      streamAiText({
        feature: "chat",
        signals: SIGNALS,
        system: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 10,
        signal: controller.signal,
      }),
    );

    // Without this the generator can stop *reading* deltas but the upstream
    // request keeps running, and billing, into a socket nobody consumes.
    expect(openRouterStreamMock.mock.calls[0][0]).toMatchObject({ signal: controller.signal });
  });

  it("does not escalate to the next rung when the caller aborted", async () => {
    const controller = new AbortController();
    openRouterStreamMock.mockImplementation(() => yieldThenAbort(controller, ["partial"]));

    const { error } = await drain(
      streamAiText({
        feature: "chat",
        signals: SIGNALS,
        system: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 10,
        signal: controller.signal,
      }),
    );

    expect(error).toBeInstanceOf(Error);
    // One call, not two: the second rung is the expensive one.
    expect(openRouterStreamMock).toHaveBeenCalledTimes(1);
  });

  it("still escalates on a genuine model failure before any output", async () => {
    openRouterStreamMock
      .mockImplementationOnce(async function* () {
        throw new Error("upstream 503");
      })
      .mockImplementationOnce(async function* () {
        yield "recovered";
      });

    const { text } = await drain(
      streamAiText({
        feature: "chat",
        signals: SIGNALS,
        system: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 10,
      }),
    );

    // The abort guard must not have broken normal escalation.
    expect(openRouterStreamMock).toHaveBeenCalledTimes(2);
    expect(text).toContain("recovered");
  });

  it("yields whatever was produced before the abort, so a partial reply is not lost", async () => {
    const controller = new AbortController();
    openRouterStreamMock.mockImplementation(() => yieldThenAbort(controller, ["Hello ", "world"]));

    const { text } = await drain(
      streamAiText({
        feature: "chat",
        signals: SIGNALS,
        system: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 10,
        signal: controller.signal,
      }),
    );

    expect(text).toBe("Hello world");
  });

  it("records usage for the aborted attempt rather than losing the spend", async () => {
    const controller = new AbortController();
    openRouterStreamMock.mockImplementation(() => yieldThenAbort(controller, ["partial"]));

    await drain(
      streamAiText({
        feature: "chat",
        signals: SIGNALS,
        system: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 10,
        signal: controller.signal,
      }),
    );

    // Tokens were generated before the abort landed; not recording them would
    // make the cost dashboard under-report exactly the case this fix targets.
    expect(recordUsageMock).toHaveBeenCalled();
  });

  it("works unchanged when no signal is passed", async () => {
    openRouterStreamMock.mockImplementation(async function* () {
      yield "fine";
    });

    const { text, error } = await drain(
      streamAiText({
        feature: "chat",
        signals: SIGNALS,
        system: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 10,
      }),
    );

    expect(error).toBeNull();
    expect(text).toBe("fine");
  });
});

describe("generateAiJson abort handling", () => {
  it("does not escalate to the next rung when the caller aborted", async () => {
    const controller = new AbortController();
    openRouterCompleteMock.mockImplementation(async () => {
      controller.abort();
      throw Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
    });

    await expect(
      generateAiJson({
        feature: "recommendations",
        signals: JSON_SIGNALS,
        system: "s",
        prompt: "p",
        schema: { type: "object" },
        schemaName: "s",
        maxTokens: 10,
        signal: controller.signal,
      }),
    ).rejects.toThrow();

    expect(openRouterCompleteMock).toHaveBeenCalledTimes(1);
  });

  it("passes the signal down to the provider", async () => {
    const controller = new AbortController();
    openRouterCompleteMock.mockResolvedValue({
      text: JSON.stringify({ ok: true }),
      usage: { inputTokens: 1, outputTokens: 1, costUsd: 0 },
    });

    await generateAiJson({
      feature: "recommendations",
      signals: JSON_SIGNALS,
      system: "s",
      prompt: "p",
      schema: { type: "object" },
      schemaName: "s",
      maxTokens: 10,
      signal: controller.signal,
    });

    expect(openRouterCompleteMock.mock.calls[0][0]).toMatchObject({ signal: controller.signal });
  });
});
