export type CurrencyCode = "USD" | "ZiG" | "ZAR";

export type CurrencyDef = {
  code: CurrencyCode;
  label: string;
  symbol: string;
  flag: string;
  /** Units of this currency per 1 USD — approximate, for reference only. */
  perUsd: number;
};

// Static reference rates from the Reserve Bank of Zimbabwe's published daily
// interbank mid rates (spot the daily rate at the link shown in the settings
// currency switcher). For reference/display only — not live market data; never
// passed to the AI assistant as fact.
export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", label: "US Dollar", symbol: "$", flag: "🇺🇸", perUsd: 1 },
  { code: "ZiG", label: "Zimbabwe Gold", symbol: "ZiG", flag: "🇿🇼", perUsd: 26.6039 },
  { code: "ZAR", label: "Rand", symbol: "R", flag: "🇿🇦", perUsd: 16.3473 },
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

export function formatCurrency(amount: number, code: CurrencyCode): string {
  const def = BY_CODE.get(code);
  const symbol = def?.symbol ?? code;
  return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
