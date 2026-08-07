import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_CSP_HASH } from "./themeScript";
import { contentSecurityPolicy } from "./securityHeaders";

describe("theme init script CSP hash", () => {
  it("matches the script it authorises", () => {
    // The failure this guards against is silent and total: edit the script,
    // forget the hash, and the browser refuses to run it — every visitor
    // gets a flash of the wrong theme with nothing in the console but a CSP
    // report. Recomputing here means that can only ever fail in CI.
    const actual = createHash("sha256").update(THEME_INIT_SCRIPT, "utf8").digest("base64");
    expect(THEME_INIT_SCRIPT_CSP_HASH).toBe(`'sha256-${actual}'`);
  });

  it("is present in the emitted script-src", () => {
    const csp = contentSecurityPolicy("nonce-value", false);
    const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"))!;
    expect(scriptSrc).toContain(THEME_INIT_SCRIPT_CSP_HASH);
  });

  it("only touches localStorage inside a try/catch", () => {
    // Safari in private mode throws on localStorage access. An uncaught
    // throw here runs before hydration and takes the whole page with it.
    expect(THEME_INIT_SCRIPT).toContain("try {");
    expect(THEME_INIT_SCRIPT).toContain("catch (e) {}");
  });
});
