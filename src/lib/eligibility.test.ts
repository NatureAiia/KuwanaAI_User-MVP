import { describe, expect, it } from "vitest";
import { formatRequirement, getListingRequirements, isRequirementAttribute } from "@/lib/eligibility";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

const SCHEMA: AttributeSchemaFieldDTO[] = [
  { key: "min_balance", label: "Min. balance", dataType: "number", unit: "USD", isComparable: true, sortOrder: 0 },
  { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD", isComparable: true, sortOrder: 1 },
];

describe("isRequirementAttribute", () => {
  it("flags known requirement keys and nothing else", () => {
    expect(isRequirementAttribute("min_balance")).toBe(true);
    expect(isRequirementAttribute("monthly_fee")).toBe(false);
  });
});

describe("getListingRequirements", () => {
  it("extracts only requirement-registered attributes present on the listing", () => {
    const requirements = getListingRequirements(
      { attributes: { min_balance: 50, monthly_fee: 5 } },
      SCHEMA,
    );
    expect(requirements).toEqual([{ key: "min_balance", label: "Min. balance", value: 50, unit: "USD" }]);
  });

  it("returns nothing when the requirement attribute is absent from the listing", () => {
    const requirements = getListingRequirements({ attributes: { monthly_fee: 5 } }, SCHEMA);
    expect(requirements).toEqual([]);
  });

  it("returns nothing when the category schema has no requirement-registered attribute at all", () => {
    const noRequirementSchema: AttributeSchemaFieldDTO[] = [
      { key: "data_gb", label: "Data", dataType: "number", unit: "GB", isComparable: true, sortOrder: 0 },
    ];
    expect(getListingRequirements({ attributes: { data_gb: 5 } }, noRequirementSchema)).toEqual([]);
  });
});

describe("formatRequirement", () => {
  it("formats a numeric requirement with its unit", () => {
    expect(formatRequirement({ key: "min_balance", label: "Min. balance", value: 50, unit: "USD" })).toBe(
      "Min. balance: 50 USD",
    );
  });

  it("formats a requirement with no unit", () => {
    expect(formatRequirement({ key: "min_balance", label: "Min. balance", value: 50, unit: null })).toBe(
      "Min. balance: 50",
    );
  });
});
