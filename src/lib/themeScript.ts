/**
 * The anti-FOUC theme script, and the CSP hash that authorises it.
 *
 * Kept in one module because the two must never drift: the hash in
 * `script-src` is computed over exactly the bytes rendered into the page, so
 * editing the script without updating the hash means the browser silently
 * refuses to run it and every visitor gets a flash of the wrong theme.
 * `themeScript.test.ts` recomputes the hash and fails if they diverge.
 *
 * WHY A HASH RATHER THAN A NONCE
 *
 * This script previously shipped via `next/script`, which picks up the
 * per-request nonce from the CSP header automatically. That broke hydration
 * on every single page load:
 *
 *   <script
 *  +   nonce={undefined}   <- what React renders on the client
 *  -   nonce=""            <- what is actually in the DOM
 *
 * Per the CSP spec, browsers blank out the `nonce` *content attribute* once
 * the document is parsed, so a nonce can't be read back out via an attribute
 * selector; the real value survives only on the `.nonce` DOM property. React
 * compares the rendered attribute against the emptied one and reports a
 * whole-tree attribute mismatch — "this won't be patched up".
 *
 * A nonce is the right tool for scripts whose content varies per request.
 * This one is a compile-time constant, so a hash is both a better fit and
 * strictly tighter: a nonce authorises whatever script carries it, while a
 * hash authorises these exact bytes and nothing else.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("kuwana-theme");
    if (theme === "light") document.documentElement.classList.remove("dark");
    else document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

/**
 * base64 sha256 of THEME_INIT_SCRIPT, as a literal rather than something
 * computed at request time: the middleware this feeds runs on the edge
 * runtime, where the only digest API is async (`crypto.subtle`), and hashing
 * a constant on every request to get a constant answer is pure waste. The
 * accompanying test is what keeps it honest.
 */
export const THEME_INIT_SCRIPT_CSP_HASH = "'sha256-pmP1NPLfeAIHq1Ei2viIkSj+HQWcm4ZrFDShzelrIMk='";
