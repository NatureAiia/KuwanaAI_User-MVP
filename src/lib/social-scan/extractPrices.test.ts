import { describe, expect, it } from "vitest";
import { extractPrices } from "@/lib/social-scan/extractPrices";

describe("extractPrices", () => {
  it("extracts a bare dollar amount as USD", () => {
    expect(extractPrices("data bundle for $5")).toEqual([{ amount: 5, currency: "USD", raw: "$5" }]);
  });

  it("doesn't leave a dangling 'US' when matching 'US$' (longer symbol wins)", () => {
    const result = extractPrices("only US$12.50 this week");
    expect(result).toEqual([{ amount: 12.5, currency: "USD", raw: "US$12.50" }]);
  });

  it("parses comma-separated thousands", () => {
    expect(extractPrices("laptop going for $1,250")).toEqual([{ amount: 1250, currency: "USD", raw: "$1,250" }]);
  });

  it("recognizes ZWG amounts distinctly from USD", () => {
    expect(extractPrices("ZWG 350 for the SIM")).toEqual([{ amount: 350, currency: "ZWG", raw: "ZWG 350" }]);
  });

  it("is case-insensitive on the currency symbol", () => {
    expect(extractPrices("usd25 flat rate")).toEqual([{ amount: 25, currency: "USD", raw: "usd25" }]);
  });

  it("finds multiple prices in the same text", () => {
    const result = extractPrices("was $10, now just $7.50");
    expect(result).toEqual([
      { amount: 10, currency: "USD", raw: "$10" },
      { amount: 7.5, currency: "USD", raw: "$7.50" },
    ]);
  });

  it("returns nothing for text with no price-like substring", () => {
    expect(extractPrices("great service, highly recommend")).toEqual([]);
  });

  it("ignores a zero amount", () => {
    expect(extractPrices("free for $0")).toEqual([]);
  });

  it("recognizes the Z$/ZW$ ZWG symbol variants", () => {
    expect(extractPrices("Z$40 taxi fare")).toEqual([{ amount: 40, currency: "ZWG", raw: "Z$40" }]);
    expect(extractPrices("ZW$40 taxi fare")).toEqual([{ amount: 40, currency: "ZWG", raw: "ZW$40" }]);
  });
});
