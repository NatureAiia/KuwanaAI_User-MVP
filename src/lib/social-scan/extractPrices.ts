export type ExtractedPrice = { amount: number; currency: string; raw: string };

// Order matters: longer/more specific symbols first so "US$" isn't matched as
// a bare "$" leaving a dangling "US".
const PRICE_PATTERN = /(US\$|USD|ZWG|ZW\$|Z\$|\$)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi;

const CURRENCY_BY_SYMBOL: Record<string, string> = {
  "us$": "USD",
  usd: "USD",
  "$": "USD",
  zwg: "ZWG",
  "zw$": "ZWG",
  "z$": "ZWG",
};

/** Finds price-like substrings ("$5", "US$12.50", "ZWG 350") in free text. */
export function extractPrices(text: string): ExtractedPrice[] {
  const found: ExtractedPrice[] = [];
  for (const match of text.matchAll(PRICE_PATTERN)) {
    const [raw, symbol, amountStr] = match;
    const amount = Number(amountStr.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const currency = CURRENCY_BY_SYMBOL[symbol.toLowerCase()] ?? "USD";
    found.push({ amount, currency, raw: raw.trim() });
  }
  return found;
}
