import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

/**
 * Total-cost breakdown for a listing, built entirely from fields already on
 * the record — never derived math. The spec forbids invented statistics, so
 * the summary simply lists the price once (it's already the headline row)
 * plus any *recurring or per-use* fees the category actually seeds. A
 * hypothetical "effective monthly cost" derived from a bundle price + validity
 * would be an arbitrary conversion, so it's deliberately not attempted.
 *
 * Fee keys live in two small registries below, mirroring the way
 * `eligibility.ts` registers requirement attributes — extend them when new
 * cost-style attributes get seeded.
 */

/** Recurring fees billed on a fixed cadence. */
const RECURRING_FREQUENCIES: Record<string, string> = {
  monthly_fee: "per month",
  premium_monthly: "per month",
  term_fees: "per term",
};

/** Per-use fees charged on each transaction/withdrawal. */
const PER_USE_FREQUENCIES: Record<string, string> = {
  atm_withdrawal_fee: "per ATM withdrawal",
  transaction_fee: "per transaction",
  fee_per_transaction: "per transaction",
};

const COST_FREQUENCIES: Record<string, string> = {
  ...RECURRING_FREQUENCIES,
  ...PER_USE_FREQUENCIES,
};

export function isCostAttribute(key: string): boolean {
  return key in COST_FREQUENCIES;
}

export type TotalCostField = {
  key: string;
  label: string;
  value: unknown;
  unit: string | null;
  frequency: string;
};

export function getTotalCostFields(
  listing: Pick<ListingDTO, "attributes">,
  attributeSchema: AttributeSchemaFieldDTO[],
): TotalCostField[] {
  return attributeSchema
    .filter((a) => isCostAttribute(a.key))
    .map((a) => ({
      key: a.key,
      label: a.label,
      value: listing.attributes[a.key],
      unit: a.unit,
      frequency: COST_FREQUENCIES[a.key],
    }))
    .filter((f) => f.value !== undefined && f.value !== null && f.value !== false);
}

/**
 * A plain-language total-cost line, e.g. "2 USD per month + 1 USD per ATM
 * withdrawal", or null when the listing has no recurring/per-use fees beyond
 * its headline price. A zero value is kept (a "0 USD per month" account fee
 * is meaningful); booleans are never cost fields.
 */
export function buildTotalCostSummary(
  listing: Pick<ListingDTO, "attributes">,
  attributeSchema: AttributeSchemaFieldDTO[],
): string | null {
  const fields = getTotalCostFields(listing, attributeSchema);
  if (fields.length === 0) return null;
  return fields
    .map((f) => {
      const value = typeof f.value === "number" ? String(f.value) : String(f.value);
      return `${value}${f.unit ? ` ${f.unit}` : ""} ${f.frequency}`;
    })
    .join(" + ");
}
