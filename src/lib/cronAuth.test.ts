import { afterEach, describe, expect, it } from "vitest";
import { verifyCronRequest } from "@/lib/cronAuth";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  process.env.CRON_SECRET = originalCronSecret;
});

function requestWithAuth(header: string | null) {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("https://example.com/api/cron/freshness", { headers });
}

describe("verifyCronRequest", () => {
  it("fails closed (500, not a free pass) when CRON_SECRET isn't configured", () => {
    delete process.env.CRON_SECRET;
    const result = verifyCronRequest(requestWithAuth("Bearer anything"));
    expect(result?.status).toBe(500);
  });

  it("rejects a request with no Authorization header", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronRequest(requestWithAuth(null));
    expect(result?.status).toBe(401);
  });

  it("rejects a request with the wrong secret", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronRequest(requestWithAuth("Bearer wrong-secret"));
    expect(result?.status).toBe(401);
  });

  it("rejects a bearer-less variant of the correct secret", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronRequest(requestWithAuth("test-secret"));
    expect(result?.status).toBe(401);
  });

  it("allows the request through (returns null) with the correct bearer secret", () => {
    process.env.CRON_SECRET = "test-secret";
    const result = verifyCronRequest(requestWithAuth("Bearer test-secret"));
    expect(result).toBeNull();
  });
});
