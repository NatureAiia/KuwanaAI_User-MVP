/**
 * Thin client for Paynow (Zimbabwe payment gateway — see .env.example),
 * covering both integration tiers:
 *  - WEB REDIRECT (initiateTransaction) — the wallet top-up flow at
 *    src/app/api/wallet/topup, src/app/api/wallet/paynow/webhook, and
 *    src/app/wallet/return. Sends the customer to Paynow's hosted page.
 *  - ADVANCED INTEGRATION / EXPRESS CHECKOUT (initiateExpressCheckout) — the
 *    flow at src/app/api/wallet/topup/express. Charges a mobile money number
 *    directly via Paynow's API, no redirect; the customer authorizes on
 *    their phone. Shares the webhook/poll/crediting plumbing above.
 * Talks to Paynow's classic form-urlencoded API
 * (https://www.paynow.co.zw/interface/{initiatetransaction,remotetransaction})
 * as documented at https://developers.paynow.co.zw at the time this was written.
 *
 * Paynow issues a separate merchant integration (its own ID + key pair) per
 * settlement currency, so every function here takes a `currency` and picks
 * the matching credential pair.
 *
 * IMPORTANT — verify before going live: the exact field order used below for
 * both the outgoing initiate-transaction hash and the incoming
 * response/webhook hash is Paynow's documented order at the time this was
 * written, but Paynow's docs have historically had rough edges here (e.g.
 * whether the `amount` field is sent with a fixed 2 decimal places). Confirm
 * against a real sandbox round-trip — see the plan's verification steps —
 * before trusting this in production. `paynowStatus` on WalletTransaction
 * always keeps the raw response string regardless, so nothing is silently
 * lost even if the enum mapping below needs adjusting later.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export class PaynowNotConfiguredError extends Error {
  constructor(currency: "USD" | "ZiG") {
    super(
      `PAYNOW_INTEGRATION_ID${currency === "ZiG" ? "_ZIG" : ""}/PAYNOW_INTEGRATION_KEY${
        currency === "ZiG" ? "_ZIG" : ""
      } is not set — see .env.example.`,
    );
  }
}

function getCredentials(currency: "USD" | "ZiG"): { id: string; key: string } {
  const suffix = currency === "ZiG" ? "_ZIG" : "";
  const id = process.env[`PAYNOW_INTEGRATION_ID${suffix}`];
  const key = process.env[`PAYNOW_INTEGRATION_KEY${suffix}`];
  if (!id || !key) throw new PaynowNotConfiguredError(currency);
  return { id, key };
}

const PAYNOW_INITIATE_URL = "https://www.paynow.co.zw/interface/initiatetransaction";
const PAYNOW_EXPRESS_URL = "https://www.paynow.co.zw/interface/remotetransaction";

/**
 * UPPERCASE(SHA512(concatenated field VALUES, in the given order, + integration
 * key)) — the hash field itself is never part of its own input. Missing
 * fields contribute an empty string, matching Paynow's own behaviour for
 * optional fields.
 */
function computeHash(fields: Record<string, string>, orderedKeys: string[], integrationKey: string): string {
  const concatenated = orderedKeys.map((k) => fields[k] ?? "").join("") + integrationKey;
  return createHash("sha512").update(concatenated, "utf8").digest("hex").toUpperCase();
}

// Paynow's documented field order for the outgoing initiatetransaction call.
const INITIATE_HASH_FIELD_ORDER = [
  "id",
  "reference",
  "amount",
  "additionalinfo",
  "returnurl",
  "resulturl",
  "authemail",
  "status",
];

// Paynow's documented field order for the initiate response and the
// result-url (webhook) callback share the same shape.
const RESPONSE_HASH_FIELD_ORDER = ["reference", "paynowreference", "amount", "status", "pollurl"];

export type InitiateParams = {
  reference: string;
  amount: number;
  currency: "USD" | "ZiG";
  additionalInfo: string;
  returnUrl: string;
  resultUrl: string;
  authEmail: string;
};

export type InitiateResult = { ok: true; browserUrl: string; pollUrl: string } | { ok: false; error: string };

// Advanced Integration / Express Checkout's documented field order — same
// shape as INITIATE_HASH_FIELD_ORDER plus `phone`/`method`, inserted before
// `status` per Paynow's docs at the time this was written. Verify against a
// sandbox round-trip before trusting this in production, same caveat as the
// web-redirect hash order above.
const EXPRESS_HASH_FIELD_ORDER = [
  "id",
  "reference",
  "amount",
  "additionalinfo",
  "returnurl",
  "resulturl",
  "authemail",
  "phone",
  "method",
  "status",
];

export type MobileMoneyMethod = "ecocash" | "onemoney" | "innbucks";

export type ExpressCheckoutParams = {
  reference: string;
  amount: number;
  currency: "USD" | "ZiG";
  additionalInfo: string;
  returnUrl: string;
  resultUrl: string;
  authEmail: string;
  phone: string;
  method: MobileMoneyMethod;
};

export type ExpressCheckoutResult =
  | { ok: true; pollUrl: string; instructions?: string }
  | { ok: false; error: string };

/**
 * Advanced Integration / Express Checkout — POSTs directly to Paynow with the
 * customer's mobile money number and network instead of redirecting to
 * Paynow's hosted page. The customer authorizes on their phone (USSD/PIN
 * prompt); status still only becomes trustworthy via the webhook/poll, same
 * as the web-redirect flow.
 */
export async function initiateExpressCheckout(params: ExpressCheckoutParams): Promise<ExpressCheckoutResult> {
  const { id, key } = getCredentials(params.currency);

  const fields: Record<string, string> = {
    id,
    reference: params.reference,
    amount: params.amount.toFixed(2),
    additionalinfo: params.additionalInfo,
    returnurl: params.returnUrl,
    resulturl: params.resultUrl,
    authemail: params.authEmail,
    phone: params.phone,
    method: params.method,
    status: "Message",
  };
  const hash = computeHash(fields, EXPRESS_HASH_FIELD_ORDER, key);

  const body = new URLSearchParams({ ...fields, hash });
  const res = await fetch(PAYNOW_EXPRESS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return { ok: false, error: `Paynow returned HTTP ${res.status}` };

  const raw = await res.text();
  const response = Object.fromEntries(new URLSearchParams(raw));

  if ((response.status ?? "").toLowerCase() === "error") {
    return { ok: false, error: response.error ?? "Paynow rejected the transaction" };
  }
  if (!response.pollurl) {
    return { ok: false, error: "Paynow response missing pollurl" };
  }
  return { ok: true, pollUrl: response.pollurl, instructions: response.instructions };
}

export async function initiateTransaction(params: InitiateParams): Promise<InitiateResult> {
  const { id, key } = getCredentials(params.currency);

  const fields: Record<string, string> = {
    id,
    reference: params.reference,
    amount: params.amount.toFixed(2),
    additionalinfo: params.additionalInfo,
    returnurl: params.returnUrl,
    resulturl: params.resultUrl,
    authemail: params.authEmail,
    status: "Message",
  };
  const hash = computeHash(fields, INITIATE_HASH_FIELD_ORDER, key);

  const body = new URLSearchParams({ ...fields, hash });
  const res = await fetch(PAYNOW_INITIATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return { ok: false, error: `Paynow returned HTTP ${res.status}` };

  const raw = await res.text();
  const response = Object.fromEntries(new URLSearchParams(raw));

  if ((response.status ?? "").toLowerCase() === "error") {
    return { ok: false, error: response.error ?? "Paynow rejected the transaction" };
  }
  if (!response.browserurl || !response.pollurl) {
    return { ok: false, error: "Paynow response missing browserurl/pollurl" };
  }
  return { ok: true, browserUrl: response.browserurl, pollUrl: response.pollurl };
}

/**
 * Verifies a webhook/poll response's `hash` field against a freshly computed
 * one, using the integration key for the given currency. Never throws —
 * returns false on any mismatch or missing field. Callers must fail closed.
 */
export function verifyPaynowHash(fields: Record<string, string>, currency: "USD" | "ZiG"): boolean {
  if (!fields.hash) return false;
  try {
    const { key } = getCredentials(currency);
    const expected = computeHash(fields, RESPONSE_HASH_FIELD_ORDER, key);
    // Constant-time. `===` on a MAC leaks, through its own running time, how
    // many leading characters of a guess were right — which turns forging a
    // "paid" callback from an infeasible search into a per-character one.
    // Both sides are fixed-length uppercase SHA512 hex, so a length mismatch
    // is itself a failure and timingSafeEqual's equal-length requirement is
    // never the thing that rejects.
    const candidate = Buffer.from(fields.hash.toUpperCase(), "utf8");
    const reference = Buffer.from(expected, "utf8");
    if (candidate.length !== reference.length) return false;
    return timingSafeEqual(candidate, reference);
  } catch {
    return false;
  }
}

/**
 * Paynow's own hosts. `pollUrl` is read back out of our database and then
 * fetched, so it is a server-side request to a stored URL — the shape that
 * becomes SSRF the moment anything upstream can influence the stored value.
 * Today it can only come from Paynow's own response body, which makes this
 * defence in depth rather than a patch for a live hole; it costs one string
 * comparison and removes the class.
 */
function isPaynowHost(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    // Suffix match on a dot-prefixed root, so `evil-paynow.co.zw` and
    // `paynow.co.zw.attacker.test` both fail.
    return (
      url.protocol === "https:" &&
      (url.hostname === "paynow.co.zw" || url.hostname.endsWith(".paynow.co.zw"))
    );
  } catch {
    return false;
  }
}

/** Poll requests are a fallback on a page render — bounded so a hung Paynow cannot hang the page. */
const POLL_TIMEOUT_MS = 10_000;

/** GET pollUrl fallback, used by the return page if the webhook hasn't landed yet. Never throws. */
export async function pollTransactionStatus(
  pollUrl: string,
): Promise<{ status: string; paynowReference?: string } | null> {
  if (!isPaynowHost(pollUrl)) {
    console.error("[paynow] refusing to poll a non-Paynow URL");
    return null;
  }
  try {
    const res = await fetch(pollUrl, {
      method: "POST",
      signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const raw = await res.text();
    const fields = Object.fromEntries(new URLSearchParams(raw));
    if (!fields.status) return null;
    return { status: fields.status, paynowReference: fields.paynowreference };
  } catch {
    return null;
  }
}

const STATUS_MAP: Record<string, "paid" | "cancelled" | "pending" | "refunded"> = {
  paid: "paid",
  "awaiting delivery": "paid",
  delivered: "paid",
  cancelled: "cancelled",
  disputed: "pending",
  refunded: "refunded",
  created: "pending",
  sent: "pending",
};

/** Maps Paynow's raw status string to our TopUpStatus, defaulting unknown strings to "pending" — never throws. */
export function normalizeStatus(paynowStatus: string): "paid" | "cancelled" | "pending" | "refunded" {
  return STATUS_MAP[paynowStatus.trim().toLowerCase()] ?? "pending";
}
