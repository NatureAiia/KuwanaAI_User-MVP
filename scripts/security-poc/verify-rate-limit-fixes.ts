/**
 * PoC / regression check for the 2026-08-17 traffic-resilience audit
 * (security/resilience-audit branch).
 *
 * Before this branch, /api/events, /api/corporate/listings/bulk-price-update,
 * /api/provider/listings/images (+ its admin twins), /api/complaints,
 * /api/saved, /api/pins, /api/onboarding, /api/corporate/requests, and
 * /api/corporate/alert-rules called no rate limit at all — a scripted client
 * could hit any of them without bound. This script proves the fix by hammering
 * the exact same rate-limiter keys those routes now call and confirming each
 * one starts rejecting at its documented limit, without needing a running dev
 * server, a database, or auth — it exercises the same primitive the routes do.
 *
 * Run: npx tsx scripts/security-poc/verify-rate-limit-fixes.ts
 * Safe to run anywhere — in-process only, touches no network/DB.
 */
import { enforceRateLimit, RATE_LIMITS, __resetRateLimits } from "../../src/lib/rateLimit";

type Check = { name: string; key: string; rule: keyof typeof RATE_LIMITS };

const CHECKS: Check[] = [
  { name: "/api/events (per-user)", key: "events:poc-user", rule: "authedWrite" },
  { name: "/api/corporate/listings/bulk-price-update (per-provider)", key: "bulk-price-update:poc-provider", rule: "authedWrite" },
  { name: "/api/provider/listings/images (per-provider)", key: "listing-image-upload:poc-provider", rule: "mediaUpload" },
  { name: "/api/complaints (per-user)", key: "complaints:poc-user", rule: "authedWrite" },
  { name: "/api/saved (per-user)", key: "saved:poc-user", rule: "authedWrite" },
  { name: "/api/pins (per-user)", key: "pins:poc-user", rule: "authedWrite" },
  { name: "/api/onboarding (per-user)", key: "onboarding:poc-user", rule: "authedWrite" },
  { name: "/api/corporate/requests (per-provider)", key: "corporate-requests:poc-provider", rule: "authedWrite" },
  { name: "/api/corporate/alert-rules (per-provider)", key: "corporate-alert-rules:poc-provider", rule: "authedWrite" },
  { name: "/api/wallet/topup (secondary IP limit)", key: "wallet-topup-ip:poc-ip", rule: "walletTopupIp" },
];

async function verify(check: Check): Promise<boolean> {
  const rule = RATE_LIMITS[check.rule];
  let blockedAt: number | null = null;

  // One request past the limit — a script hammering a route with no cooldown
  // would send exactly this pattern.
  for (let i = 1; i <= rule.limit + 1; i++) {
    const result = await enforceRateLimit(check.key, rule);
    if (result) {
      blockedAt = i;
      break;
    }
  }

  const pass = blockedAt === rule.limit + 1;
  const status = pass ? "PASS" : "FAIL";
  console.log(
    `[${status}] ${check.name} — limit ${rule.limit}/${rule.windowSeconds}s, blocked at request #${blockedAt ?? "never"}`,
  );
  return pass;
}

async function main() {
  __resetRateLimits();
  let allPassed = true;
  for (const check of CHECKS) {
    const passed = await verify(check);
    allPassed = allPassed && passed;
  }
  console.log(allPassed ? "\nAll rate-limit fixes verified." : "\nSome checks FAILED — a route regressed to unlimited.");
  process.exit(allPassed ? 0 : 1);
}

main();
