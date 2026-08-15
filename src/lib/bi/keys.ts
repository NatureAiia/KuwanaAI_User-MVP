import { randomBytes, createHash } from "node:crypto";

const KEY_PREFIX = "kuwana_bi_";

/** Sha256 hex — one-way, so a leaked database row never reveals the usable key. */
export function hashApiKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}

/**
 * Generates a new key and its hash together. The plaintext is returned to
 * the caller exactly once (the admin API-key-creation response) — only the
 * hash is ever persisted, matching how every other secret in this app
 * (Supabase session tokens, wallet webhooks) is handled.
 */
export function generateApiKey(): { plaintextKey: string; hashedKey: string } {
  const plaintextKey = KEY_PREFIX + randomBytes(24).toString("hex");
  return { plaintextKey, hashedKey: hashApiKey(plaintextKey) };
}
