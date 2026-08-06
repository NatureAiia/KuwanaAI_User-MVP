import { describe, expect, it } from "vitest";
import {
  LISTING_IMAGE_URL_PREFIX,
  providerCreateListingSchema,
  providerUpdateListingSchema,
} from "@/lib/providerListingSchema";

const BASE = { categoryId: "cat-1", name: "Test Plan", attributes: {}, price: 10 };
const validImageUrl = (n: number) => `${LISTING_IMAGE_URL_PREFIX}provider-1/${n}.jpg`;

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

  it("defaults images to an empty array when omitted", () => {
    const result = providerCreateListingSchema.safeParse(BASE);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.images).toEqual([]);
  });

  it("accepts up to 8 images from our own upload endpoint", () => {
    const images = Array.from({ length: 8 }, (_, i) => validImageUrl(i));
    expect(providerCreateListingSchema.safeParse({ ...BASE, images }).success).toBe(true);
  });

  it("rejects a 9th image", () => {
    const images = Array.from({ length: 9 }, (_, i) => validImageUrl(i));
    expect(providerCreateListingSchema.safeParse({ ...BASE, images }).success).toBe(false);
  });

  it("rejects an image URL that didn't come from our own bucket", () => {
    expect(
      providerCreateListingSchema.safeParse({ ...BASE, images: ["https://evil.example/x.png"] }).success,
    ).toBe(false);
  });
});

describe("providerUpdateListingSchema", () => {
  it("allows a partial update with no status change", () => {
    expect(providerUpdateListingSchema.safeParse({ price: 15 }).success).toBe(true);
  });

  it.each(["published", "rejected"])("rejects status: %s in an update too", (status) => {
    expect(providerUpdateListingSchema.safeParse({ status }).success).toBe(false);
  });

  it("leaves images untouched (optional, no default) when omitted", () => {
    const result = providerUpdateListingSchema.safeParse({ price: 15 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.images).toBeUndefined();
  });

  it("rejects a non-bucket image URL in an update too", () => {
    expect(
      providerUpdateListingSchema.safeParse({ images: ["https://evil.example/x.png"] }).success,
    ).toBe(false);
  });
});
