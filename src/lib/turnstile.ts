/**
 * Cloudflare Turnstile verification.
 *
 * Verified here directly against Cloudflare for every caller — the waitlist
 * route, and login (inside authorize(), see src/lib/nextAuth.ts). Signup does
 * NOT call this a second time: a Cloudflare token is single-use, and
 * authorize() already verifies the same token when the signup flow signs the
 * new account in immediately after registering it (see src/app/signup/
 * page.tsx). There is no Supabase Auth backend left to hand the token to
 * implicitly, unlike this file's previous incarnation.
 *
 * FAILURE POLICY: fails **closed** when a secret is configured, and skips
 * entirely when one is not. That combination is deliberate. Failing open on a
 * configured deployment would make an outage at Cloudflare a free pass for
 * every bot; refusing to run without a secret would break local development
 * and every existing deploy the moment this merges.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** A challenge is a page-load-time control; nothing here should hold a request open. */
const VERIFY_TIMEOUT_MS = 5_000;

export type TurnstileResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: string };

/** True when this deployment is expected to enforce Turnstile. */
export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Verifies a token against Cloudflare.
 *
 * `remoteIp` should come from clientKey()'s trusted-hop logic rather than a
 * raw header — Cloudflare cross-checks it against the address that solved the
 * challenge, so a spoofable value would cause spurious failures.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };

  if (!token) return { ok: false, reason: "missing-input-response" };

  const body = new URLSearchParams({ secret, response: token });
  // "unknown" is clientKey's placeholder when nothing identified the caller;
  // sending it through would be a guaranteed mismatch.
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: `siteverify-http-${response.status}` };

    const payload = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (payload.success) return { ok: true, skipped: false };
    return { ok: false, reason: payload["error-codes"]?.join(",") || "verification-failed" };
  } catch {
    // Fail closed: a configured deployment that cannot reach Cloudflare must
    // not silently drop the control.
    return { ok: false, reason: "siteverify-unreachable" };
  }
}
