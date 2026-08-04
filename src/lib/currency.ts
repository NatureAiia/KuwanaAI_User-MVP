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

/** Converts an amount from its own listing currency into the target display currency, via USD as the pivot. */
export function convertCurrency(amount: number, from: string, to: CurrencyCode): number {
  const fromDef = BY_CODE.get(from as CurrencyCode);
  const toDef = BY_CODE.get(to);
  if (!fromDef || !toDef) return amount;
  const usd = amount / fromDef.perUsd;
  return usd * toDef.perUsd;
}

export function formatCurrency(amount: number, code: CurrencyCode): string {
  const def = BY_CODE.get(code);
  const symbol = def?.symbol ?? code;
  return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
