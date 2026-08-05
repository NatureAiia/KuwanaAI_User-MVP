// Real, server-side signals backing the self-service Corporate/Regulator
// signup paths — see HANDOFF.md's "Security (do not reopen these)" section.
// That fix restricted self-service to `role: "consumer"` because the client
// could otherwise just assert `role: "corporate"` with nothing to back it
// up. These checks are what makes reopening those roles safe: they key off
// the *authenticated* Supabase email (never client-supplied), which the
// signup form can't spoof.

// Common free/personal email providers — a Corporate account must not be
// backed by one of these. This is a heuristic (not proof of a real company),
// but it closes the exact gap the original vulnerability left open: nothing
// stopped anyone from asserting "corporate" with any address at all.
const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
  "msn.com",
  "rocketmail.com",
  "ymail.com",
]);

export function emailDomain(email: string): string | null {
  return email.split("@")[1]?.toLowerCase() ?? null;
}

export function isPersonalEmailDomain(email: string): boolean {
  const domain = emailDomain(email);
  return !domain || PERSONAL_EMAIL_DOMAINS.has(domain);
}

// A small, curated set of Zimbabwean regulators — self-service is only safe
// here because each name maps to one specific verified domain, not an open
// text field. Regulator self-registration was the exact vulnerability
// HANDOFF.md closed; this is the "real verification" that makes it safe to
// reopen, not a return to trusting the client's word.
export const REGULATORS = [
  {
    name: "POTRAZ",
    fullName: "Postal & Telecommunications Regulatory Authority of Zimbabwe",
    domain: "potraz.gov.zw",
  },
  { name: "RBZ", fullName: "Reserve Bank of Zimbabwe", domain: "rbz.co.zw" },
  { name: "IPEC", fullName: "Insurance & Pensions Commission", domain: "ipec.co.zw" },
] as const;

export type RegulatorName = (typeof REGULATORS)[number]["name"];
export const REGULATOR_NAMES = REGULATORS.map((r) => r.name) as [RegulatorName, ...RegulatorName[]];

export function emailMatchesRegulator(email: string, regulatorName: string): boolean {
  const domain = emailDomain(email);
  const regulator = REGULATORS.find((r) => r.name === regulatorName);
  return !!domain && !!regulator && domain === regulator.domain;
}
