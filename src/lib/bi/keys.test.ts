import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/bi/keys";

describe("hashApiKey", () => {
  it("is deterministic for the same input", () => {
    expect(hashApiKey("kuwana_bi_abc")).toBe(hashApiKey("kuwana_bi_abc"));
  });

  it("produces different hashes for different keys", () => {
    expect(hashApiKey("kuwana_bi_abc")).not.toBe(hashApiKey("kuwana_bi_def"));
  });

  it("returns a 64-char lowercase hex sha256 digest", () => {
    expect(hashApiKey("kuwana_bi_abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateApiKey", () => {
  it("prefixes the plaintext key with kuwana_bi_", () => {
    const { plaintextKey } = generateApiKey();
    expect(plaintextKey.startsWith("kuwana_bi_")).toBe(true);
  });

  it("returns a hashedKey matching hashApiKey(plaintextKey)", () => {
    const { plaintextKey, hashedKey } = generateApiKey();
    expect(hashedKey).toBe(hashApiKey(plaintextKey));
  });

  it("generates a different key on every call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintextKey).not.toBe(b.plaintextKey);
    expect(a.hashedKey).not.toBe(b.hashedKey);
  });
});
