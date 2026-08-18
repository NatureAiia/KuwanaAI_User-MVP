import { CODE_TTL_MINUTES } from "./verification";

/**
 * The verification mail, as both plain text and HTML.
 *
 * Deliberately plain: no images, no tracking pixel, no link. A verification
 * mail that asks the reader to click is training them for the exact phishing
 * shape this control exists to make harder — the code has to be typed back
 * into a page the user navigated to themselves.
 */

const CODE_STYLE = [
  "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
  "font-size:32px",
  "font-weight:700",
  "letter-spacing:8px",
  "margin:24px 0",
  "color:#141A1F",
].join(";");

export function verificationEmail(code: string): { subject: string; text: string; html: string } {
  return {
    subject: `${code} is your Kuwana verification code`,
    text: [
      `Your Kuwana verification code is ${code}.`,
      "",
      `It expires in ${CODE_TTL_MINUTES} minutes and can only be used once.`,
      "",
      "If you didn't try to create a Kuwana account, you can ignore this email —",
      "nobody can use this code without also knowing your password.",
    ].join("\n"),
    html: [
      '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;color:#141A1F">',
      '<p style="font-size:15px">Enter this code to finish creating your Kuwana account:</p>',
      `<p style="${CODE_STYLE}">${code}</p>`,
      `<p style="font-size:14px;color:#5A6672">It expires in ${CODE_TTL_MINUTES} minutes and can only be used once.</p>`,
      '<p style="font-size:13px;color:#5A6672">If you didn&rsquo;t try to create a Kuwana account, you can ignore this email &mdash; nobody can use this code without also knowing your password.</p>',
      "</div>",
    ].join(""),
  };
}
