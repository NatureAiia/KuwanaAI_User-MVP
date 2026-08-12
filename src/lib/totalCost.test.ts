import { describe, expect, it } from "vitest";
import { buildTotalCostSummary, getTotalCostFields, isCostAttribute } from "@/lib/totalCost";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

const SCHEMA: AttributeSchemaFieldDTO[] = [
  { key: "min_balance", label: "Min. balance", dataType: "number", unit: "USD", isComparable: true, sortOrder: 0 },
  { key: "monthly_fee", label: "Monthly fee", dataType: "number", unit: "USD", isComparable: true, sortOrder: 1 },
  { key: "atm_withdrawal_fee", label: "ATM withdrawal fee", dataType: "number", unit: "USD", isComparable: true, sortOrder: 2 },
  { key: "mobile_app", label: "Mobile app", dataType: "boolean", unit: null, isComparable: true, sortOrder: 3 },
];

describe("isCostAttribute", () => {
  it("flags recurring and per-use fee keys and nothing else", () => {
    expect(isCostAttribute("monthly_fee")).toBe(true);
    expect(isCostAttribute("premium_monthly")).toBe(true);
    expect(isCostAttribute("term_fees")).toBe(true);
    expect(isCostAttribute("atm_withdrawal_fee")).toBe(true);
    expect(isCostAttribute("transaction_fee")).toBe(true);
    expect(isCostAttribute("fee_per_transaction")).toBe(true);
    expect(isCostAttribute("min_balance")).toBe(false);
    expect(isCostAttribute("mobile_app")).toBe(false);
  });
});

describe("getTotalCostFields", () => {
  it("extracts only cost-registered attributes present on the listing", () => {
    const fields = getTotalCostFields(
      { attributes: { monthly_fee: 2, atm_withdrawal_fee: 1, min_balance: 50, mobile_app: true } },
      SCHEMA,
    );
    expect(fields).toEqual([
      { key: "monthly_fee", label: "Monthly fee", value: 2, unit: "USD", frequency: "per month" },
      { key: "atm_withdrawal_fee", label: "ATM withdrawal fee", value: 1, unit: "USD", frequency: "per ATM withdrawal" },
    ]);
  });

  it("skips cost fields that are absent on the listing", () => {
    const fields = getTotalCostFields({ attributes: { monthly_fee: 2 } }, SCHEMA);
    expect(fields).toEqual([
      { key: "monthly_fee", label: "Monthly fee", value: 2, unit: "USD", frequency: "per month" },
    ]);
  });
});

describe("buildTotalCostSummary", () => {
  it("joins recurring and per-use fees into a grounded plain-language line", () => {
    expect(
      buildTotalCostSummary({ attributes: { monthly_fee: 2, atm_withdrawal_fee: 1 } }, SCHEMA),
    ).toBe("2 USD per month + 1 USD per ATM withdrawal");
  });

  it("keeps a zero fee — it is meaningful information", () => {
    expect(buildTotalCostSummary({ attributes: { monthly_fee: 0 } }, SCHEMA)).toBe("0 USD per month");
  });

  it("returns null when the listing has no cost fields", () => {
    expect(buildTotalCostSummary({ attributes: { min_balance: 50, mobile_app: true } }, SCHEMA)).toBeNull();
  });
});
