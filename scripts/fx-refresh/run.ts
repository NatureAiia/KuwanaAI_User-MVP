/**
 * Refreshes FxRate from a free, keyless FX API — replacing the static
 * reference table in lib/currency.ts wherever a live rate is actually
 * available. The static table (sourced from the Reserve Bank of Zimbabwe's
 * published daily rates) stays as the guaranteed fallback if this hasn't run
 * yet or the source is unreachable — see getPerUsdMap() in lib/currency.ts.
 *
 *   npx tsx scripts/fx-refresh/run.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";
import { CURRENCIES } from "@/lib/currency";

const SOURCE = "open.er-api.com";
const API_URL = "https://open.er-api.com/v6/latest/USD";

// Kuwana's CurrencyCode values don't all match ISO 4217 — Zimbabwe Gold is
// "ZiG" in the app (matching local usage) but "ZWG" upstream.
const ISO_CODE_OVERRIDES: Partial<Record<string, string>> = { ZiG: "ZWG" };

/** Shared by the CLI entrypoint below and src/app/api/cron/fx-refresh/route.ts. */
export async function runFxRefresh() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`FX API request failed: HTTP ${res.status}`);
  const body = await res.json();
  if (body.result !== "success") throw new Error(`FX API returned non-success result: ${body.result}`);

  const liveRates = body.rates as Record<string, number>;
  let updated = 0;

  for (const currency of CURRENCIES) {
    if (currency.code === "USD") continue; // USD is always the pivot, always 1.

    const isoCode = ISO_CODE_OVERRIDES[currency.code] ?? currency.code;
    const rate = liveRates[isoCode];
    if (rate == null) {
      console.log(`[fx-refresh] ${currency.code} (${isoCode}) not available from source — static fallback stays in effect.`);
      continue;
    }

    await prisma.fxRate.upsert({
      where: { code: currency.code },
      update: { perUsd: rate, source: SOURCE, fetchedAt: new Date() },
      create: { code: currency.code, perUsd: rate, source: SOURCE },
    });
    updated += 1;
    console.log(`[fx-refresh] ${currency.code}: 1 USD = ${rate}`);
  }

  const trackedNonUsd = CURRENCIES.length - 1;
  console.log(`\n[fx-refresh] updated ${updated}/${trackedNonUsd} live currencies.`);
  return { updated, trackedNonUsd };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFxRefresh()
    .catch((err) => {
      console.error("[fx-refresh] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
