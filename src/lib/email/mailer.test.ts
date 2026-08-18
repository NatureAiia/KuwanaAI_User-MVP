import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.fn();
// Typed through the generic rather than a named parameter, so `mock.calls`
// stays inspectable without declaring an argument the stub never reads.
const createTransport = vi.fn<(config: Record<string, unknown>) => { sendMail: typeof sent }>(
  () => ({ sendMail: sent }),
);

vi.mock("nodemailer", () => ({ default: { createTransport } }));

const { isMailerConfigured, sendMail, __resetMailer } = await import("@/lib/email/mailer");

const originalEnv = { ...process.env };

beforeEach(() => {
  sent.mockReset();
  createTransport.mockClear();
  __resetMailer();
  process.env.SMTP_HOST = "smtp.example.com";
  process.env.EMAIL_FROM = "Kuwana <no-reply@kuwana.ai>";
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("isMailerConfigured", () => {
  it("is true only when both a host and a from address are set", () => {
    expect(isMailerConfigured()).toBe(true);
    delete process.env.EMAIL_FROM;
    expect(isMailerConfigured()).toBe(false);
    process.env.EMAIL_FROM = "a@b.com";
    delete process.env.SMTP_HOST;
    expect(isMailerConfigured()).toBe(false);
  });
});

describe("transport configuration", () => {
  const config = () => createTransport.mock.calls[0][0] as Record<string, unknown>;

  it("defaults to submission port 587 with STARTTLS required", async () => {
    await sendMail({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>" });
    expect(config().port).toBe(587);
    expect(config().secure).toBe(false);
    // Without requireTLS, a server that simply omits STARTTLS gets the SMTP
    // credentials in the clear.
    expect(config().requireTLS).toBe(true);
  });

  it("uses implicit TLS on 465 without being told to", async () => {
    process.env.SMTP_PORT = "465";
    await sendMail({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>" });
    expect(config().secure).toBe(true);
  });

  it("refuses to read files or URLs, the surface this package keeps being patched for", async () => {
    await sendMail({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>" });
    expect(config().disableFileAccess).toBe(true);
    expect(config().disableUrlAccess).toBe(true);
  });

  it("omits auth entirely when no SMTP user is configured", async () => {
    await sendMail({ to: "a@b.com", subject: "s", text: "t", html: "<p>t</p>" });
    expect(config().auth).toBeUndefined();
  });
});

describe("sendMail", () => {
  it("sends from the configured address", async () => {
    await sendMail({ to: "a@b.com", subject: "Code", text: "123456", html: "<p>123456</p>" });
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Kuwana <no-reply@kuwana.ai>", to: "a@b.com" }),
    );
  });

  it("refuses a recipient containing a line break", async () => {
    // `to` comes from a signup form. A newline in it lets the sender append
    // their own SMTP headers to a message our domain sends.
    await expect(
      sendMail({ to: "a@b.com\r\nBcc: victim@example.com", subject: "s", text: "t", html: "t" }),
    ).rejects.toThrow(/line break/);
    expect(sent).not.toHaveBeenCalled();
  });

  it("refuses a subject containing a line break", async () => {
    await expect(
      sendMail({ to: "a@b.com", subject: "s\nBcc: victim@example.com", text: "t", html: "t" }),
    ).rejects.toThrow(/line break/);
    expect(sent).not.toHaveBeenCalled();
  });

  it("propagates a transport failure rather than resolving quietly", async () => {
    // A code that never arrived must not leave the user waiting at a code box.
    sent.mockRejectedValue(new Error("connection refused"));
    await expect(
      sendMail({ to: "a@b.com", subject: "s", text: "t", html: "t" }),
    ).rejects.toThrow(/connection refused/);
  });
});
