import { describe, expect, it } from "vitest";
import { providerCreateListingSchema, providerUpdateListingSchema } from "@/lib/providerListingSchema";

const BASE = { categoryId: "cat-1", name: "Test Plan", attributes: {}, price: 10 };

describe("providerCreateListingSchema", () => {
  it("defaults status to draft when omitted", () => {
    const result = providerCreateListingSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("draft");
  });

  it("accepts pending_review", () => {
    expect(providerCreateListingSchema.safeParse({ ...BASE, status: "pending_review" }).success).toBe(true);
  });

  it.each(["published", "rejected"])(
    "rejects status: %s — a provider can never self-publish or self-reject",
    (status) => {
      expect(providerCreateListingSchema.safeParse({ ...BASE, status }).success).toBe(false);
    },
  );

  it("rejects a non-positive price", () => {
    expect(providerCreateListingSchema.safeParse({ ...BASE, price: 0 }).success).toBe(false);
    expect(providerCreateListingSchema.safeParse({ ...BASE, price: -5 }).success).toBe(false);
  });
});

describe("providerUpdateListingSchema", () => {
  it("allows a partial update with no status change", () => {
    expect(providerUpdateListingSchema.safeParse({ price: 15 }).success).toBe(true);
  });

  it.each(["published", "rejected"])("rejects status: %s in an update too", (status) => {
    expect(providerUpdateListingSchema.safeParse({ status }).success).toBe(false);
  });
});
