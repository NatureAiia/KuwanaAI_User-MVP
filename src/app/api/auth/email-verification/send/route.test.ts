import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const enforceRateLimit = vi.fn();
const isMailerConfigured = vi.fn();
const sendMail = vi.fn();
const issueVerificationCode = vi.fn();

vi.mock("@/lib/nextAuth", () => ({ auth: authMock }));
vi.mock("@/lib/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rateLimit")>()),
  enforceRateLimit,
  clientKey: () => "203.0.113.1",
}));
vi.mock("@/lib/email/mailer", () => ({ isMailerConfigured, sendMail }));
// CODE_TTL_MINUTES is re-exported through templates.ts, which the route
// imports — omitting it from the mock makes the module fail to link.
vi.mock("@/lib/email/verification", () => ({ issueVerificationCode, CODE_TTL_MINUTES: 10 }));

const { POST } = await import("./route");

const request = () =>
  new Request("http://localhost/api/auth/email-verification/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

beforeEach(() => {
  authMock.mockReset();
  enforceRateLimit.mockReset();
  isMailerConfigured.mockReset();
  sendMail.mockReset();
  issueVerificationCode.mockReset();

  authMock.mockResolvedValue({ user: { id: "u1", email: "person@example.com" } });
  enforceRateLimit.mockResolvedValue(null);
  isMailerConfigured.mockReturnValue(true);
  issueVerificationCode.mockResolvedValue("123456");
  sendMail.mockResolvedValue(undefined);
});

describe("POST /api/auth/email-verification/send", () => {
  it("refuses without a session", async () => {
    authMock.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
  });

  it("mails the code to the address on the session, never one from the body", async () => {
    // The body cannot name a recipient at all — this is what stops the route
    // being used to mail codes into somebody else's inbox.
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(issueVerificationCode).toHaveBeenCalledWith("u1", "person@example.com");
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "person@example.com" }));
  });

  it("reports that verification is not in force when no mailer is configured", async () => {
    isMailerConfigured.mockReturnValue(false);
    const res = await POST(request());
    expect(await res.json()).toEqual({ sent: false, verificationRequired: false });
    expect(issueVerificationCode).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("still says verification is required when the send itself fails", async () => {
    // The client uses this flag to decide whether to show the code screen. A
    // failed send does not make a configured deployment stop requiring one.
    sendMail.mockRejectedValue(new Error("smtp down"));
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect((await res.json()).verificationRequired).toBe(true);
  });

  it("never puts the code in the server log", async () => {
    // Logs are read by more people than should be able to finish a signup.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    sendMail.mockRejectedValue(new Error("smtp down"));
    await POST(request());
    expect(JSON.stringify(error.mock.calls)).not.toContain("123456");
    error.mockRestore();
  });

  it("mints nothing when the caller is rate limited", async () => {
    enforceRateLimit.mockResolvedValueOnce(
      new Response(null, { status: 429 }) as unknown as null,
    );
    const res = await POST(request());
    expect(res.status).toBe(429);
    expect(issueVerificationCode).not.toHaveBeenCalled();
  });

  it("limits per IP as well as per user, so a farm of accounts shares one budget", async () => {
    await POST(request());
    const keys = enforceRateLimit.mock.calls.map((call) => call[0]);
    expect(keys).toContain("verify-send:u1");
    expect(keys).toContain("verify-send-ip:203.0.113.1");
  });

  it("never lets a response be cached", async () => {
    const res = await POST(request());
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
