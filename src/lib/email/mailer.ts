import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP transport for the transactional mail this app sends (currently only
 * signup verification codes).
 *
 * SMTP rather than a provider SDK: every mail provider worth using — Resend,
 * SES, Postmark, SendGrid, Mailgun — exposes one, so the choice of provider
 * stays a deployment decision instead of a code change. nodemailer has no
 * runtime dependencies of its own, so this costs one package rather than a
 * dependency tree in an app that gates CI on vulnerability scans.
 *
 * CONFIGURED-OR-SKIP, the same policy as src/lib/turnstile.ts. With no SMTP
 * host set, `isMailerConfigured()` is false and the caller skips verification
 * entirely, so local development and every existing deployment behave exactly
 * as they did before this shipped. Hard-requiring it would have made this
 * merge the moment nobody could sign up. That means **the deployment is half
 * the control**: verification only actually gates anything once these
 * variables are set. See SECURITY_HARDENING.md.
 */

const DEFAULT_PORT = 587;

/** Bounded so a hung mail server cannot hold a signup request open. */
const SEND_TIMEOUT_MS = 10_000;

let transporter: Transporter | null = null;

function smtpPort(): number {
  const configured = Number(process.env.SMTP_PORT);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_PORT;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const port = smtpPort();
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Implicit TLS on 465; everything else negotiates STARTTLS. `requireTLS`
    // makes that upgrade mandatory rather than opportunistic — without it a
    // server that simply omits STARTTLS gets the credentials in the clear.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    requireTLS: true,
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } }
      : {}),
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
    // Belt and braces against the CRLF-injection class this package has been
    // repeatedly patched for (GHSA-268h-hp4c-crq3 and friends): nothing here
    // reads a file or a URL, so nothing should be able to talk it into doing
    // either through a header or an attachment reference.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return transporter;
}

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Throws on failure rather than resolving quietly — a verification code that
 * was never delivered must not leave the user staring at a code entry box for
 * a mail that is not coming.
 */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  // Guards the class of bug the CRLF advisories describe: `to` originates
  // from a signup form. A newline in it would let the sender append their own
  // SMTP headers (Bcc, Reply-To) to a mail our domain signs.
  if (/[\r\n]/.test(mail.to) || /[\r\n]/.test(mail.subject)) {
    throw new Error("Refusing to send: header field contains a line break");
  }

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

/** Test-only: drops the memoized transport so env changes take effect. */
export function __resetMailer() {
  transporter = null;
}
