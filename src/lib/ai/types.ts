/** Shared shapes between the provider facade and its per-provider adapters. */

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * Provider-neutral message. The object form exists only because chat can
 * attach one image to the user's turn; every other call site passes a string.
 */
export type NormalizedMessage = {
  role: "user" | "assistant";
  content: string | { text: string; image?: { mediaType: string; data: string } };
};
