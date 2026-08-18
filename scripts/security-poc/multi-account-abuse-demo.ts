/**
 * PoC for the 2026-08-17 multi-account-abuse audit (security/resilience-audit
 * branch). Unlike verify-rate-limit-fixes.ts, this isn't proving a fix —
 * these gaps are NOT closed on this branch (see SECURITY_AUDIT.md for why:
 * closing them needs a CAPTCHA/infra decision, not just a code patch). This
 * script demonstrates the actual mechanism by reading the schema/rate-limit
 * config directly, so the claim is checkable rather than asserted.
 *
 * Run: npx tsx scripts/security-poc/multi-account-abuse-demo.ts
 * Read-only — inspects source/schema, makes no network or DB calls, creates
 * no accounts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function readSchema(): string {
  return readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
}

function main() {
  section("1. Ban evasion — is there ANY correlatable signal on User?");
  const schema = readSchema();
  const userModelMatch = schema.match(/model User \{[\s\S]*?\n\}/);
  const userModel = userModelMatch?.[0] ?? "";
  const correlationFields = ["ipAddress", "signupIp", "deviceId", "phone", "fingerprint"];
  const present = correlationFields.filter((f) => userModel.includes(f));
  console.log(
    present.length === 0
      ? "  CONFIRMED GAP: none of ipAddress/signupIp/deviceId/phone/fingerprint exist on User."
      : `  Found: ${present.join(", ")} — re-check SECURITY_AUDIT.md, this may already be fixed.`,
  );
  console.log(
    "  Impact: a suspended account (accountStatus = 'suspended') has zero barrier to the same",
  );
  console.log("  person signing up again with a new email seconds later — the ban is per-identity-string only.");

  section("2. Signup throttling — is signup routed through this app's own rate limiter at all?");
  const signupPage = readFileSync(join(ROOT, "src", "app", "signup", "page.tsx"), "utf8");
  const callsSupabaseDirectly = /supabase\.auth\.signUp/.test(signupPage);
  console.log(
    callsSupabaseDirectly
      ? "  CONFIRMED GAP: signup calls supabase.auth.signUp() directly from the client —"
      : "  Signup appears to be proxied through a server route — re-check, this may already be fixed.",
  );
  if (callsSupabaseDirectly) {
    console.log("  this never touches src/lib/rateLimit.ts, so Kuwana's own IP-based throttling cannot see it.");
    console.log("  A scripted signup loop is bounded only by whatever limit Supabase's own Auth API applies.");
  }

  section("3. Rate limits keyed by account, not by correlated identity");
  const rateLimitSrc = readFileSync(join(ROOT, "src", "lib", "rateLimit.ts"), "utf8");
  const hasWalletIpLimit = /walletTopupIp/.test(rateLimitSrc);
  console.log(
    hasWalletIpLimit
      ? "  Wallet top-up now has a secondary IP-keyed limit (this branch's fix) — the single highest-value"
      : "  CONFIRMED GAP: wallet top-up limits are per-user only.",
  );
  console.log("  target for spreading load across accounts. Gamification-writing routes (events, saved, comparisons,");
  console.log("  footprint) remain per-user only by design — legitimate single-account farming is what those guard");
  console.log("  against; a farm of N accounts each stays under its own cap and in aggregate mints N times the XP.");
  console.log("  Closing that fully requires reducing how many accounts one person can cheaply create (see #1/#2),");
  console.log("  not more rate-limit keys.");

  section("Summary");
  console.log("These three findings compound: cheap account creation (#2) + no ban correlation (#1) means a farm");
  console.log("of accounts can be created faster than they can be banned, and per-account limits (#3) don't stop");
  console.log("that farm from acting as one actor. See SECURITY_AUDIT.md 'Multi-account abuse' section for the");
  console.log("recommended pragmatic-MVP fix (signup CAPTCHA + IP throttle) vs. the ideal one (phone/device verification).");
}

main();
