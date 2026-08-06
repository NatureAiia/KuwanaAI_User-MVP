import { describe, expect, it } from "vitest";
import { csvField } from "@/components/ExportCsvButton";

describe("csvField", () => {
  it("leaves a plain value unquoted", () => {
    expect(csvField("Telecom")).toBe("Telecom");
    expect(csvField(42.5)).toBe("42.5");
  });

  it("quotes and doubles embedded quotes", () => {
    expect(csvField('CBZ "Gold" Savings')).toBe('"CBZ ""Gold"" Savings"');
  });

  it("quotes a value containing a comma", () => {
    expect(csvField("Banking, Insurance")).toBe('"Banking, Insurance"');
  });

  it("quotes a value containing a newline", () => {
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });
});
