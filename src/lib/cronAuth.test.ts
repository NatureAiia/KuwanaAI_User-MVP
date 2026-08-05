import { describe, it, expect, afterEach } from "vitest";
import { verifyCronRequest } from "./cronAuth";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

function reqWith(authorization?: string) {
  return new Request("https://example.test/api/cron/freshness", {
    headers: authorization ? { authorization } : {},
  });
}

describe("verifyCronRequest", () => {
  it("fails closed with a 500 when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    // Not 401: an unconfigured secret is a deployment fault, not a caller
    // fault, and must never be read as "no secret set, so allow everything".
    expect(verifyCronRequest(reqWith("Bearer anything"))?.status).toBe(500);
  });

  it("accepts the exact configured bearer token", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(verifyCronRequest(reqWith("Bearer s3cret-value"))).toBeNull();
  });

  it("rejects a missing, malformed, or wrong token", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(verifyCronRequest(reqWith())?.status).toBe(401);
    expect(verifyCronRequest(reqWith("s3cret-value"))?.status).toBe(401);
    expect(verifyCronRequest(reqWith("Bearer wrong"))?.status).toBe(401);
  });

  it("rejects a token that merely shares a prefix with the real one", () => {
    // The case a short-circuiting `===` would leak timing information on.
    process.env.CRON_SECRET = "abcdefghijklmnop";
    expect(verifyCronRequest(reqWith("Bearer abcdefghijklmno"))?.status).toBe(401);
    expect(verifyCronRequest(reqWith("Bearer abcdefghijklmnopq"))?.status).toBe(401);
  });
});
