import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { attributeSchemaField: { findMany } },
}));

const { validateListingAttributes } = await import("@/lib/attributeValidation");

const SAVINGS_SCHEMA = [
  { key: "monthly_fee", label: "Monthly fee", dataType: "number" },
  { key: "mobile_app", label: "Mobile app", dataType: "string" },
  { key: "overdraft", label: "Overdraft available", dataType: "boolean" },
  { key: "network", label: "Network", dataType: "enum" },
];

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue(SAVINGS_SCHEMA);
});

describe("validateListingAttributes", () => {
  it("passes undefined attributes through with no query", async () => {
    const result = await validateListingAttributes("cat-1", undefined);
    expect(result).toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("accepts values whose JS type matches the declared dataType", async () => {
    const result = await validateListingAttributes("cat-1", {
      monthly_fee: 2,
      mobile_app: "CBZ Touch App",
      overdraft: true,
      network: "Econet",
    });
    expect(result).toBeNull();
  });

  it("ignores null/undefined values (clearing a field is allowed)", async () => {
    const result = await validateListingAttributes("cat-1", { monthly_fee: null });
    expect(result).toBeNull();
  });

  it("rejects a boolean stored as a string instead of a real boolean", async () => {
    const result = await validateListingAttributes("cat-1", { overdraft: "true" });
    expect(result).toMatch(/must be a boolean/);
  });

  it("rejects a number stored as a numeric string", async () => {
    const result = await validateListingAttributes("cat-1", { monthly_fee: "2" });
    expect(result).toMatch(/must be a number/);
  });

  it("rejects a string field given a non-string value", async () => {
    const result = await validateListingAttributes("cat-1", { mobile_app: true });
    expect(result).toMatch(/must be a string/);
  });

  it("rejects a key that isn't in the category's declared schema", async () => {
    const result = await validateListingAttributes("cat-1", { not_a_real_key: 1 });
    expect(result).toMatch(/isn't a recognized attribute/);
  });
});
