/**
 * Sanitises a `?next=` destination before it is handed to a router.
 *
 * The login page took `params.get("next")` straight into `router.push()`.
 * The middleware only ever *writes* a same-origin pathname into that
 * parameter, but nothing stops an attacker from sending someone a link with
 * their own value:
 *
 *   https://kuwana.example/login?next=https://kuwana-support.example/verify
 *
 * The victim sees the real Kuwana domain, signs in with real credentials,
 * and is then handed to the attacker's page — a credible place to ask for
 * "one more confirmation". That is an open redirect, and it is the standard
 * opening move for a phishing chain against a login flow.
 *
 * Only a path on this origin is allowed through; everything else falls back.
 */
const FALLBACK = "/dashboard";

// Control characters (NUL, tab, newline, DEL). Some URL parsers strip these
// *before* evaluating the result, which can smuggle a scheme past the checks
// below — e.g. "/\tjavascript:alert(1)" normalising to "/javascript:alert(1)".
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(next: string | null | undefined, fallback: string = FALLBACK): string {
  if (!next) return fallback;

  // Must be an absolute path on this origin.
  if (!next.startsWith("/")) return fallback;

  // "//evil.example" and "/\evil.example" are protocol-relative URLs: a
  // browser reads them as a different origin even though they start with a
  // slash. This is the bypass a naive startsWith("/") check misses.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;

  // A backslash anywhere is normalised to "/" by browsers, so reject it
  // outright rather than reason about where in the string it sits.
  if (next.includes("\\")) return fallback;

  if (hasControlChar(next)) return fallback;

  return next;
}
