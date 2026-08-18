import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const enforceRateLimit = vi.fn();
const isMailerConfigured = vi.fn();
const verifyCode = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rateLimit")>()),
  enforceRateLimit,
  clientKey: () => "203.0.113.1",
}));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { updateMany } } }));
vi.mock("@/lib/email/mailer", () => ({ isMailerConfigured }));
vi.mock("@/lib/email/verification", () => ({ verifyCode, MAX_ATTEMPTS: 5 }));

const { POST } = await import("./route");

const request = (body: unknown) =>
  new Request("http://localhost/api/auth/email-verification/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  getUser.mockReset();
  enforceRateLimit.mockReset();
  isMailerConfigured.mockReset();
  verifyCode.mockReset();
  updateMany.mockReset();

  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "person@example.com" } } });
  enforceRateLimit.mockResolvedValue(null);
  isMailerConfigured.mockReturnValue(true);
  verifyCode.mockResolvedValue({ ok: true });
  updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/auth/email-verification/verify", () => {
  it("refuses without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({ code: "123456" }))).status).toBe(401);
  });

  it("accepts a correct code and stamps the user row", async () => {
    const res = await POST(request({ code: "123456" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "u1", emailVerifiedAt: null },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it("checks the code against the session's own user and email", async () => {
    await POST(request({ code: "123456" }));
    expect(verifyCode).toHaveBeenCalledWith("u1", "person@example.com", "123456");
  });

  it("rejects a malformed code without touching the stored one", async () => {
    // Spending one of the five attempts on a body that could never have been
    // minted would let an attacker exhaust a victim's budget for free.
    for (const code of ["12345", "abcdef", "", "1234567"]) {
      const res = await POST(request({ code }));
      expect(res.status).toBe(400);
    }
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it("rejects a body with no code at all", async () => {
    expect((await POST(request({}))).status).toBe(400);
  });

  it("gives the same message for a wrong, expired and never-issued code", async () => {
    // Telling these apart would let an attacker probe which addresses are
    // mid-signup.
    const messages = new Set<string>();
    for (const reason of ["mismatch", "expired", "no_code"]) {
      verifyCode.mockResolvedValue({ ok: false, reason });
      const res = await POST(request({ code: "123456" }));
      expect(res.status).toBe(400);
      messages.add((await res.json()).error);
    }
    expect(messages.size).toBe(1);
  });

  it("does say when the attempt budget is spent, since retrying is futile", async () => {
    verifyCode.mockResolvedValue({ ok: false, reason: "too_many_attempts" });
    const res = await POST(request({ code: "123456" }));
    expect((await res.json()).error).toMatch(/request a new one/i);
  });

  it("does not stamp the user row on a failed attempt", async () => {
    verifyCode.mockResolvedValue({ ok: false, reason: "mismatch" });
    await POST(request({ code: "123456" }));
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports verification as not in force when no mailer is configured", async () => {
    isMailerConfigured.mockReturnValue(false);
    const res = await POST(request({ code: "123456" }));
    expect(await res.json()).toEqual({ verified: false, verificationRequired: false });
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it("checks nothing when the caller is rate limited", async () => {
    enforceRateLimit.mockResolvedValueOnce(new Response(null, { status: 429 }) as unknown as null);
    expect((await POST(request({ code: "123456" }))).status).toBe(429);
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it("limits per IP as well as per user", async () => {
    await POST(request({ code: "123456" }));
    const keys = enforceRateLimit.mock.calls.map((call) => call[0]);
    expect(keys).toContain("verify-code:u1");
    expect(keys).toContain("verify-code-ip:203.0.113.1");
  });

  it("never lets a response be cached", async () => {
    const res = await POST(request({ code: "123456" }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
