import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttributeSchemaFieldDTO } from "@/types/catalog";

const generateAiJson = vi.fn();

vi.mock("@/lib/ai/provider", () => ({ generateAiJson: generateAiJson }));

const { extractListingCandidate } = await import("@/lib/scrape/extract");

const SCHEMA: AttributeSchemaFieldDTO[] = [
  { key: "data_amount", label: "Data amount", dataType: "number", unit: "GB", isComparable: true, sortOrder: 0 },
  { key: "auto_renew", label: "Auto-renews", dataType: "boolean", unit: null, isComparable: true, sortOrder: 1 },
];

beforeEach(() => {
  generateAiJson.mockReset();
});

describe("extractListingCandidate", () => {
  it("builds a JSON schema field for every category attribute, typed from its dataType", async () => {
    generateAiJson.mockResolvedValue({
      name: "EcoData 5GB",
      price: 5,
      currency: "USD",
      description: "Monthly data bundle",
      provider_name_guess: "Econet",
      attributes: { data_amount: 5, auto_renew: false },
      confidence: 0.8,
    });

    await extractListingCandidate({ markdown: "# EcoData 5GB — $5/month", sourceUrl: "https://econet.co.zw", attributeSchema: SCHEMA });

    const call = generateAiJson.mock.calls[0][0];
    expect(call.feature).toBe("scrape_extract");
    expect(call.schema.properties.attributes.properties.data_amount.type).toEqual(["number", "null"]);
    expect(call.schema.properties.attributes.properties.auto_renew.type).toEqual(["boolean", "null"]);
  });

  it("maps the model's fields onto the candidate shape and clamps confidence into [0, 1]", async () => {
    generateAiJson.mockResolvedValue({
      name: "EcoData 5GB",
      price: 5,
      currency: "USD",
      description: null,
      provider_name_guess: "Econet",
      attributes: { data_amount: 5 },
      confidence: 1.4,
    });

    const result = await extractListingCandidate({ markdown: "content", sourceUrl: "https://example.com", attributeSchema: [] });

    expect(result.data).toEqual({
      name: "EcoData 5GB",
      price: 5,
      currency: "USD",
      description: null,
      provider_name_guess: "Econet",
      attributes: { data_amount: 5 },
    });
    expect(result.confidence).toBe(1);
  });

  it("treats a non-numeric confidence as zero rather than throwing", async () => {
    generateAiJson.mockResolvedValue({
      name: "Unclear page",
      price: null,
      currency: null,
      description: null,
      provider_name_guess: null,
      attributes: {},
      confidence: "not a number",
    });

    const result = await extractListingCandidate({ markdown: "content", sourceUrl: "https://example.com", attributeSchema: [] });
    expect(result.confidence).toBe(0);
  });
});
