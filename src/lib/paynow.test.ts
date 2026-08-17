import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initiateExpressCheckout,
  initiateTransaction,
  normalizeStatus,
  pollTransactionStatus,
  verifyPaynowHash,
} from "@/lib/paynow";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.PAYNOW_INTEGRATION_ID = "10001";
  process.env.PAYNOW_INTEGRATION_KEY = "usd-test-key";
  process.env.PAYNOW_INTEGRATION_ID_ZIG = "20002";
  process.env.PAYNOW_INTEGRATION_KEY_ZIG = "zig-test-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

// Mirrors paynow.ts's own RESPONSE_HASH_FIELD_ORDER — kept independent here so
// the test would actually fail if that order silently changed.
const RESPONSE_HASH_FIELD_ORDER = ["reference", "paynowreference", "amount", "status", "pollurl"];

function computeExpectedHash(fields: Record<string, string>, key: string): string {
  const concatenated = RESPONSE_HASH_FIELD_ORDER.map((k) => fields[k] ?? "").join("") + key;
  return createHash("sha512").update(concatenated, "utf8").digest("hex").toUpperCase();
}

describe("verifyPaynowHash", () => {
  const baseFields = {
    reference: "KUWANA-abc123",
    paynowreference: "PN-999",
    amount: "10.00",
    status: "Paid",
    pollurl: "https://paynow.example/poll/abc",
  };

  it("accepts a correctly computed USD hash", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    expect(verifyPaynowHash({ ...baseFields, hash }, "USD")).toBe(true);
  });

  it("accepts a correctly computed ZiG hash using the ZiG-specific key", () => {
    const hash = computeExpectedHash(baseFields, "zig-test-key");
    expect(verifyPaynowHash({ ...baseFields, hash }, "ZiG")).toBe(true);
  });

  it("rejects a hash computed with the wrong currency's key", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    expect(verifyPaynowHash({ ...baseFields, hash }, "ZiG")).toBe(false);
  });

  it("rejects a tampered field even when the original hash is reused (money-adjacent, must fail closed)", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    expect(verifyPaynowHash({ ...baseFields, amount: "999.00", hash }, "USD")).toBe(false);
  });

  it("rejects when the hash field is missing entirely", () => {
    expect(verifyPaynowHash({ ...baseFields }, "USD")).toBe(false);
  });

  it("fails closed (false, not a throw) when credentials aren't configured", () => {
    delete process.env.PAYNOW_INTEGRATION_ID;
    delete process.env.PAYNOW_INTEGRATION_KEY;
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    expect(verifyPaynowHash({ ...baseFields, hash }, "USD")).toBe(false);
  });

  it("hash comparison is case-insensitive on the incoming value", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    expect(verifyPaynowHash({ ...baseFields, hash: hash.toLowerCase() }, "USD")).toBe(true);
  });

  // The compare is constant-time (crypto.timingSafeEqual), which requires
  // equal-length buffers. These cover the inputs that would otherwise make it
  // throw rather than return false — a throw here would be a 500 on the
  // webhook instead of a clean rejection.
  it("rejects a hash that is too short without throwing", () => {
    expect(verifyPaynowHash({ ...baseFields, hash: "ABCD" }, "USD")).toBe(false);
  });

  it("rejects a hash that is too long without throwing", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    expect(verifyPaynowHash({ ...baseFields, hash: hash + "00" }, "USD")).toBe(false);
  });

  it("rejects a hash of the right length that differs only in the last character", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    const flipped = hash.slice(0, -1) + (hash.endsWith("A") ? "B" : "A");
    expect(verifyPaynowHash({ ...baseFields, hash: flipped }, "USD")).toBe(false);
  });

  it("rejects a hash that differs only in the first character", () => {
    const hash = computeExpectedHash(baseFields, "usd-test-key");
    const flipped = (hash.startsWith("A") ? "B" : "A") + hash.slice(1);
    expect(verifyPaynowHash({ ...baseFields, hash: flipped }, "USD")).toBe(false);
  });
});

describe("pollTransactionStatus — host allowlist", () => {
  function stubFetch() {
    const fetchMock = vi.fn(async () => new Response("status=Paid&paynowreference=PN-1", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("polls a real Paynow URL", async () => {
    const fetchMock = stubFetch();
    const result = await pollTransactionStatus(
      "https://www.paynow.co.zw/interface/checktransactionstatus?guid=abc",
    );

    expect(fetchMock).toHaveBeenCalled();
    expect(result).toEqual({ status: "Paid", paynowReference: "PN-1" });
  });

  it("accepts the apex domain as well as a subdomain", async () => {
    const fetchMock = stubFetch();
    await pollTransactionStatus("https://paynow.co.zw/interface/checktransactionstatus?guid=abc");

    expect(fetchMock).toHaveBeenCalled();
  });

  it.each([
    ["a lookalike domain", "https://evil-paynow.co.zw/poll"],
    ["a suffixed domain", "https://paynow.co.zw.attacker.test/poll"],
    ["an unrelated host", "https://attacker.test/poll"],
    ["cleartext http", "http://paynow.co.zw/poll"],
    ["the cloud metadata endpoint", "http://169.254.169.254/latest/meta-data/"],
    ["a file URL", "file:///etc/passwd"],
    ["a malformed URL", "not-a-url"],
  ])("refuses to fetch %s", async (_label, url) => {
    const fetchMock = stubFetch();
    const result = await pollTransactionStatus(url);

    // The point is that no request is made at all, not merely that the result
    // is null — a null after the fetch would still be an SSRF.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe("normalizeStatus", () => {
  it.each([
    ["Paid", "paid"],
    ["paid", "paid"],
    ["Awaiting Delivery", "paid"],
    ["Delivered", "paid"],
    ["Cancelled", "cancelled"],
    ["Refunded", "refunded"],
    ["Created", "pending"],
    ["Sent", "pending"],
    ["Disputed", "pending"],
  ] as const)("maps Paynow status %s to %s", (input, expected) => {
    expect(normalizeStatus(input)).toBe(expected);
  });

  it("defaults an unrecognized status to pending rather than throwing", () => {
    expect(normalizeStatus("SomeFutureStatusPaynowAddsLater")).toBe("pending");
  });
});

describe("initiateTransaction", () => {
  const params = {
    reference: "KUWANA-abc123",
    amount: 10,
    currency: "USD" as const,
    additionalInfo: "Kuwana wallet top-up",
    returnUrl: "https://kuwana.example/wallet/return?ref=KUWANA-abc123",
    resultUrl: "https://kuwana.example/api/wallet/paynow/webhook",
    authEmail: "shopper@example.com",
  };

  it("rejects when credentials aren't configured, without making a network call", async () => {
    delete process.env.PAYNOW_INTEGRATION_ID;
    delete process.env.PAYNOW_INTEGRATION_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(initiateTransaction(params)).rejects.toThrow(/PAYNOW_INTEGRATION_ID/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:true with the browser/poll URLs on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          new URLSearchParams({
            status: "Ok",
            browserurl: "https://www.paynow.co.zw/Payment/ConfirmPayment/abc",
            pollurl: "https://www.paynow.co.zw/interface/checktransactionstatus?guid=abc",
            hash: "irrelevant-for-this-test",
          }).toString(),
      }),
    );

    const result = await initiateTransaction(params);
    expect(result).toEqual({
      ok: true,
      browserUrl: "https://www.paynow.co.zw/Payment/ConfirmPayment/abc",
      pollUrl: "https://www.paynow.co.zw/interface/checktransactionstatus?guid=abc",
    });
  });

  it("returns ok:false when Paynow reports an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          new URLSearchParams({ status: "Error", error: "Invalid reference" }).toString(),
      }),
    );

    const result = await initiateTransaction(params);
    expect(result).toEqual({ ok: false, error: "Invalid reference" });
  });

  it("returns ok:false on a non-2xx HTTP response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await initiateTransaction(params);
    expect(result.ok).toBe(false);
  });
});

describe("initiateExpressCheckout", () => {
  const params = {
    reference: "KUWANA-abc123",
    amount: 10,
    currency: "USD" as const,
    additionalInfo: "Kuwana wallet top-up",
    returnUrl: "https://kuwana.example/wallet/return?ref=KUWANA-abc123",
    resultUrl: "https://kuwana.example/api/wallet/paynow/webhook",
    authEmail: "shopper@example.com",
    phone: "0771234567",
    method: "ecocash" as const,
  };

  it("rejects when credentials aren't configured, without making a network call", async () => {
    delete process.env.PAYNOW_INTEGRATION_ID;
    delete process.env.PAYNOW_INTEGRATION_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(initiateExpressCheckout(params)).rejects.toThrow(/PAYNOW_INTEGRATION_ID/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ok:true with the poll URL and instructions on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          new URLSearchParams({
            status: "Ok",
            pollurl: "https://www.paynow.co.zw/interface/checktransactionstatus?guid=abc",
            instructions: "Enter your PIN when prompted.",
            hash: "irrelevant-for-this-test",
          }).toString(),
      }),
    );

    const result = await initiateExpressCheckout(params);
    expect(result).toEqual({
      ok: true,
      pollUrl: "https://www.paynow.co.zw/interface/checktransactionstatus?guid=abc",
      instructions: "Enter your PIN when prompted.",
    });
  });

  it("returns ok:false when Paynow reports an error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => new URLSearchParams({ status: "Error", error: "Invalid phone number" }).toString(),
      }),
    );

    const result = await initiateExpressCheckout(params);
    expect(result).toEqual({ ok: false, error: "Invalid phone number" });
  });

  it("returns ok:false on a non-2xx HTTP response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await initiateExpressCheckout(params);
    expect(result.ok).toBe(false);
  });
});
