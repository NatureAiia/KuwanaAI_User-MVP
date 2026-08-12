import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { publicJson } from "@/lib/apiResponse";

/**
 * Refreshed once a day by the fx-refresh cron (see vercel.json), so a
 * fifteen-minute cache is well inside the data's own update cadence — but
 * this is called by CurrencyProvider on every page load, which made it one
 * of the most frequent queries in the app for data that barely moves.
 */
const FX_CACHE_SECONDS = 900;

const readRates = unstable_cache(
  async () => {
    const rates = await prisma.fxRate.findMany();
    return {
      rates: Object.fromEntries(rates.map((r) => [r.code, r.perUsd])),
      fetchedAt:
        rates.length > 0
          ? rates.reduce((max, r) => (r.fetchedAt > max ? r.fetchedAt : max), rates[0].fetchedAt)
          : null,
    };
  },
  ["fx-rates"],
  { tags: ["fx-rates"], revalidate: FX_CACHE_SECONDS },
);

/** Public, cheap, no auth — reference exchange rates, not user data. */
export async function GET() {
  return publicJson(await readRates(), FX_CACHE_SECONDS);
}
