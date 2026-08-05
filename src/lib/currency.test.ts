import { describe, expect, it } from "vitest";
import { convertCurrency, formatCurrency, getDefaultPerUsdMap, getPerUsdMap } from "@/lib/currency";

describe("convertCurrency", () => {
  it("returns the same amount converting a currency to itself", () => {
    expect(convertCurrency(100, "USD", "USD")).toBeCloseTo(100);
  });

  it("pivots through USD correctly for two non-USD currencies", () => {
    // perUsd: ZiG 13.5, ZAR 18.2 — 135 ZiG is 10 USD, which is 182 ZAR.
    const result = convertCurrency(135, "ZiG", "ZAR");
    expect(result).toBeCloseTo(182, 0);
  });

  it("converts USD to a non-USD currency by multiplying by its rate", () => {
    const result = convertCurrency(10, "USD", "ZAR");
    expect(result).toBeCloseTo(182, 0);
  });

  it("converts a non-USD currency to USD by dividing by its rate", () => {
    const result = convertCurrency(182, "ZAR", "USD");
    expect(result).toBeCloseTo(10, 0);
  });

  it("returns the amount unchanged when the source currency has no known rate", () => {
    expect(convertCurrency(50, "MADE_UP", "USD")).toBe(50);
  });

  it("returns the amount unchanged when the target currency has no known rate in a partial override map", () => {
    expect(convertCurrency(50, "USD", "ZAR" as never, { USD: 1 })).toBe(50);
  });

  it("uses live overrides in preference to the static defaults", () => {
    // Static ZAR rate is 18.2; override it to exactly 20 and confirm the
    // override — not the static table — drove the conversion.
    const overridden = convertCurrency(1, "USD", "ZAR", getPerUsdMap({ ZAR: 20 }));
    expect(overridden).toBeCloseTo(20);
  });
});

describe("getPerUsdMap", () => {
  it("layers live overrides over the static defaults without dropping other currencies", () => {
    const map = getPerUsdMap({ ZAR: 99 });
    expect(map.ZAR).toBe(99);
    expect(map.USD).toBe(getDefaultPerUsdMap().USD);
    expect(map.ZiG).toBe(getDefaultPerUsdMap().ZiG);
  });

  it("falls back to the full static table with no overrides", () => {
    expect(getPerUsdMap()).toEqual(getDefaultPerUsdMap());
  });
});

describe("formatCurrency", () => {
  it("formats with the currency's symbol and always two decimal places", () => {
    // Not asserting the exact thousands-separator string — that's locale-
    // dependent (toLocaleString(undefined, ...)) and not what this test is
    // actually about.
    expect(formatCurrency(1234.5, "USD")).toMatch(/^\$ 1.234\.50$/);
  });

  it("uses the currency code itself as a fallback symbol for an unknown code", () => {
    expect(formatCurrency(10, "XYZ" as never)).toBe("XYZ 10.00");
  });
});
