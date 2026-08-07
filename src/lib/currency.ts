export type CurrencyCode = "USD" | "ZiG" | "ZAR" | "GBP";

export type CurrencyDef = {
  code: CurrencyCode;
  label: string;
  symbol: string;
  flag: string;
  /** Units of this currency per 1 USD — approximate, for reference only. */
  perUsd: number;
};

// Static, approximate reference rates — not live market data. Shown with an
// "approximate" disclaimer anywhere they're surfaced; never passed to the AI
// assistant as fact.
export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", label: "US Dollar", symbol: "$", flag: "🇺🇸", perUsd: 1 },
  { code: "ZiG", label: "Zimbabwe Gold", symbol: "ZiG", flag: "🇿🇼", perUsd: 13.5 },
  { code: "ZAR", label: "Rand", symbol: "R", flag: "🇿🇦", perUsd: 18.2 },
  { code: "GBP", label: "Pound", symbol: "£", flag: "🇬🇧", perUsd: 0.79 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** The static table as a plain code->rate map — the fallback wherever a live rate isn't available. */
export function getDefaultPerUsdMap(): Record<CurrencyCode, number> {
  return Object.fromEntries(CURRENCIES.map((c) => [c.code, c.perUsd])) as Record<CurrencyCode, number>;
}

/** Layers live rates (from FxRate, via /api/fx-rates) over the static defaults — never drops below full coverage. */
export function getPerUsdMap(liveOverrides: Partial<Record<string, number>> = {}): Record<string, number> {
  return { ...getDefaultPerUsdMap(), ...liveOverrides };
}

/** Converts an amount from its own listing currency into the target display currency, via USD as the pivot. */
export function convertCurrency(
  amount: number,
  from: string,
  to: CurrencyCode,
  perUsdMap: Record<string, number> = getDefaultPerUsdMap(),
): number {
  const fromRate = perUsdMap[from];
  const toRate = perUsdMap[to];
  if (fromRate == null || toRate == null) return amount;
  const usd = amount / fromRate;
  return usd * toRate;
}

/**
 * The locale prices are formatted in, pinned rather than inherited.
 *
 * `toLocaleString(undefined, …)` uses whatever locale the *runtime* has,
 * which differs between the server and the visitor's browser. That produced
 * two distinct bugs: every price was a hydration mismatch waiting to happen
 * (server renders "1 234,50", client renders "1,234.50" for the same
 * number), and two users comparing the same listing could see different
 * separators. For a price-comparison product the presentation of a price has
 * to be stable, so it is fixed here.
 */
const PRICE_LOCALE = "en-US";

export function formatCurrency(amount: number, code: CurrencyCode): string {
  const def = BY_CODE.get(code);
  const symbol = def?.symbol ?? code;
  return `${symbol} ${amount.toLocaleString(PRICE_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
