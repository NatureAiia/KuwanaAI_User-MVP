import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

/**
 * Attribute keys that represent a hard requirement to access a listing (an
 * upfront balance/deposit or a qualifying condition) rather than an ongoing
 * comparable cost or feature. The schema doesn't yet distinguish "requirement"
 * from "comparable spec" (see AttributeSchemaFieldDTO), so this is a small,
 * explicit registry — extend it as more requirement-style attributes get
 * seeded for other sectors.
 *
 * Deliberately does NOT try to infer personal eligibility (e.g. "can this
 * user afford it") — onboarding only captures a monthly spend *range* per
 * sector (SPEND_RANGES), which isn't a sound basis for comparing against a
 * lump-sum balance requirement. Inventing that conversion would itself be
 * the kind of arbitrary statistic the decision-intelligence spec forbids.
 * This only makes requirements that already exist on the listing explicit
 * and visible, rather than burying them anonymously in a generic spec table.
 */
const REQUIREMENT_ATTRIBUTE_KEYS = new Set(["min_balance"]);

export type Requirement = {
  key: string;
  label: string;
  consumerLabel: string | null;
  value: unknown;
  unit: string | null;
};

/**
 * Splits a listing's attributes into requirement-style fields (what you need
 * to qualify/access) vs everything else, using the schema's labels/units.
 */
export function getListingRequirements(
  listing: Pick<ListingDTO, "attributes">,
  attributeSchema: AttributeSchemaFieldDTO[],
): Requirement[] {
  return attributeSchema
    .filter((a) => REQUIREMENT_ATTRIBUTE_KEYS.has(a.key))
    .map((a) => ({ key: a.key, label: a.label, consumerLabel: a.consumerLabel, value: listing.attributes[a.key], unit: a.unit }))
    .filter((r) => r.value !== undefined && r.value !== null);
}

export function formatRequirement(req: Requirement): string {
  const value = typeof req.value === "number" ? req.value : String(req.value);
  return `${req.label}: ${value}${req.unit ? ` ${req.unit}` : ""}`;
}

export function isRequirementAttribute(key: string): boolean {
  return REQUIREMENT_ATTRIBUTE_KEYS.has(key);
}
