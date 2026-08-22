/**
 * Numeric attribute keys, across every category's schema, where a LOWER raw
 * value is the better outcome for the consumer — fees, minimum balances,
 * waiting periods. Everything else defaults to "higher is better" (coverage
 * amounts, interest rates, branch counts, ...). Deliberately an explicit
 * opt-in list rather than an inferred one (e.g. "contains 'fee'"): getting a
 * key wrong here should fail safe by falling through to the higher-is-better
 * default, not silently mis-flip an attribute nobody reviewed.
 */
export const LOWER_IS_BETTER_ATTRIBUTE_KEYS = new Set([
  "monthly_fee",
  "min_balance",
  "atm_withdrawal_fee",
  "transaction_fee",
  "excess",
  "premium_monthly",
  "term_fees",
  "tuition_per_year",
  "fare_estimate",
  "fee_per_transaction",
  "wait_time",
  "processing_time",
  "monthly_contribution",
  "rates_percent",
  "claim_turnaround_days",
  "payout_speed_days",
  "student_teacher_ratio",
  "rtgs_fee_app",
  "rtgs_fee_manual",
  "cost_per_watt",
]);

export function isLowerBetterAttribute(key: string): boolean {
  return LOWER_IS_BETTER_ATTRIBUTE_KEYS.has(key);
}

export type MarketPosition = {
  label: string;
  tone: "teal" | "coral" | "neutral";
};

/**
 * Describes how a listing's attribute value sits against its category's
 * median for that attribute — "12% below average", toned green/red/neutral
 * depending on whether that direction is actually good for this attribute.
 * Returns null when there's nothing meaningful to say (no median, or the
 * value is within noise of it).
 */
export function describeMarketPosition(value: number, median: number, attributeKey: string): MarketPosition | null {
  if (!Number.isFinite(value) || !Number.isFinite(median) || median === 0) return null;

  const diffPercent = Math.round(((value - median) / median) * 100);
  if (Math.abs(diffPercent) < 5) return { label: "At market average", tone: "neutral" };

  const isBelow = diffPercent < 0;
  const isGood = isLowerBetterAttribute(attributeKey) ? isBelow : !isBelow;

  return {
    label: `${Math.abs(diffPercent)}% ${isBelow ? "below" : "above"} average`,
    tone: isGood ? "teal" : "coral",
  };
}
