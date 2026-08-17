import { describe, it, expect } from "vitest";
import { contentSecurityPolicy, STATIC_SECURITY_HEADERS } from "./securityHeaders";

function directive(csp: string, name: string): string {
  const found = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(`${name} `) || d === name);
  return found ?? "";
}

describe("contentSecurityPolicy", () => {
  const prod = contentSecurityPolicy("abc123", false);

  it("binds scripts to the request's nonce and never allows unsafe-inline", () => {
    expect(directive(prod, "script-src")).toContain("'nonce-abc123'");
    expect(directive(prod, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("does not permit eval in production", () => {
    expect(directive(prod, "script-src")).not.toContain("'unsafe-eval'");
  });

  it("permits eval in development, where the Next dev server needs it", () => {
    expect(directive(contentSecurityPolicy("n", true), "script-src")).toContain("'unsafe-eval'");
  });

  it("blocks framing, plugins, and cross-origin form posts", () => {
    expect(directive(prod, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(prod, "object-src")).toBe("object-src 'none'");
    expect(directive(prod, "form-action")).toBe("form-action 'self'");
    expect(directive(prod, "base-uri")).toBe("base-uri 'self'");
  });

  it("allows remote provider logos over https but not remote scripts", () => {
    expect(directive(prod, "img-src")).toContain("https:");

    // The point is that script-src must not carry the blanket `https:`
    // *scheme* source, which would authorise any script from anywhere. It is
    // asserted per-token rather than as a substring, because a specific host
    // like https://challenges.cloudflare.com (Turnstile) also contains the
    // text "https:" while being the opposite of a blanket allowance.
    const scriptSources = directive(prod, "script-src").split(/\s+/);
    expect(scriptSources).not.toContain("https:");
    expect(scriptSources).not.toContain("*");
    expect(scriptSources).not.toContain("'unsafe-inline'");
  });

  it("allows the Turnstile iframe and nothing else to be framed", () => {
    // frame-src is not covered by 'strict-dynamic'; without it the widget is
    // blocked and the CAPTCHA silently never renders.
    const frameSources = directive(prod, "frame-src").split(/\s+/);
    expect(frameSources).toContain("https://challenges.cloudflare.com");
    expect(frameSources).not.toContain("*");
    expect(frameSources).not.toContain("https:");
  });

  it("upgrades insecure requests only in production", () => {
    expect(prod).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy("n", true)).not.toContain("upgrade-insecure-requests");
  });

  it("emits no double spaces from the optional dev-only fragments", () => {
    expect(prod).not.toMatch(/ {2}/);
    expect(prod).not.toMatch(/;\s*;/);
  });
});

describe("STATIC_SECURITY_HEADERS", () => {
  it("denies framing and MIME sniffing", () => {
    expect(STATIC_SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(STATIC_SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("does not leak full URLs to third-party origins in the referrer", () => {
    expect(STATIC_SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("leaves the microphone available to same-origin, since chat has voice input", () => {
    // useSpeechRecognition drives the chat composer's mic button; denying it
    // outright here would silently break that feature.
    expect(STATIC_SECURITY_HEADERS["Permissions-Policy"]).toContain("microphone=(self)");
    expect(STATIC_SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
    expect(STATIC_SECURITY_HEADERS["Permissions-Policy"]).toContain("geolocation=()");
  });
});
