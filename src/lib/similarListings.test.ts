import { describe, expect, it } from "vitest";
import { findClosestMatches } from "@/lib/similarListings";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

function listing(
  overrides: Partial<ListingDTO> & { id: string; provider: ListingDTO["provider"] },
): ListingDTO {
  return {
    name: overrides.id,
    description: null,
    price: 10,
    currency: "USD",
    attributes: {},
    freshnessStatus: "fresh",
    lastVerifiedAt: new Date().toISOString(),
    sourceUrl: null,
    images: [],
    rating: null,
    reviewCount: 0,
    ...overrides,
  };
}

const econet = { id: "econet", name: "Econet", logoUrl: null, verified: true, websiteUrl: null };
const netone = { id: "netone", name: "NetOne", logoUrl: null, verified: true, websiteUrl: null };
const telecel = { id: "telecel", name: "Telecel", logoUrl: null, verified: true, websiteUrl: null };

const dataBundleSchema: AttributeSchemaFieldDTO[] = [
  { key: "data_amount", label: "Data", dataType: "number", unit: "GB", isComparable: true, sortOrder: 0 },
  { key: "validity_days", label: "Validity", dataType: "number", unit: "days", isComparable: true, sortOrder: 1 },
  { key: "network", label: "Network", dataType: "string", unit: null, isComparable: true, sortOrder: 2 },
  { key: "mobile_app", label: "Mobile app", dataType: "boolean", unit: null, isComparable: true, sortOrder: 3 },
];

describe("findClosestMatches", () => {
  it("returns nothing when there are no candidates", () => {
    const target = listing({ id: "target", provider: econet, attributes: { data_amount: 5, validity_days: 30 } });
    expect(findClosestMatches(target, [], dataBundleSchema)).toEqual([]);
  });

  it("excludes candidates from the same provider as the target", () => {
    const target = listing({ id: "target", provider: econet, attributes: { data_amount: 5, validity_days: 30 } });
    const sameProvider = listing({
      id: "same-provider",
      provider: econet,
      attributes: { data_amount: 5, validity_days: 30 },
    });
    expect(findClosestMatches(target, [sameProvider], dataBundleSchema)).toEqual([]);
  });

  it("excludes a candidate that shares no comparable attribute with the target instead of scoring it 0", () => {
    const target = listing({ id: "target", provider: econet, attributes: { data_amount: 5 } });
    const noOverlap = listing({ id: "no-overlap", provider: netone, attributes: { validity_days: 30 } });
    expect(findClosestMatches(target, [noOverlap], dataBundleSchema)).toEqual([]);
  });

  it("scores a candidate with identical comparable attributes as a near-perfect match", () => {
    const target = listing({
      id: "target",
      provider: econet,
      attributes: { data_amount: 5, validity_days: 30, network: "any", mobile_app: true },
    });
    const twin = listing({
      id: "twin",
      provider: netone,
      attributes: { data_amount: 5, validity_days: 30, network: "any", mobile_app: true },
    });
    const [match] = findClosestMatches(target, [twin], dataBundleSchema);
    expect(match.listing.id).toBe("twin");
    expect(match.similarity).toBe(100);
  });

  it("ranks a numerically closer candidate above a farther one", () => {
    const target = listing({ id: "target", provider: econet, attributes: { data_amount: 5, validity_days: 30 } });
    const close = listing({ id: "close", provider: netone, attributes: { data_amount: 6, validity_days: 30 } });
    const far = listing({ id: "far", provider: telecel, attributes: { data_amount: 20, validity_days: 30 } });

    const matches = findClosestMatches(target, [close, far], dataBundleSchema);
    const closeMatch = matches.find((m) => m.listing.id === "close");
    const farMatch = matches.find((m) => m.listing.id === "far");
    expect(closeMatch).toBeDefined();
    expect(closeMatch!.similarity).toBeGreaterThan(farMatch?.similarity ?? 0);
  });

  it("scores an exact string/boolean attribute match higher than a mismatch, all else equal", () => {
    const target = listing({
      id: "target",
      provider: econet,
      attributes: { data_amount: 5, network: "4G", mobile_app: true },
    });
    const sameNetwork = listing({
      id: "same-network",
      provider: netone,
      attributes: { data_amount: 5, network: "4G", mobile_app: true },
    });
    const diffNetwork = listing({
      id: "diff-network",
      provider: telecel,
      attributes: { data_amount: 5, network: "3G", mobile_app: false },
    });

    const matches = findClosestMatches(target, [sameNetwork, diffNetwork], dataBundleSchema);
    const same = matches.find((m) => m.listing.id === "same-network");
    const diff = matches.find((m) => m.listing.id === "diff-network");
    expect(same!.similarity).toBeGreaterThan(diff?.similarity ?? 0);
  });

  it("skips a missing attribute instead of penalizing it, scoring on the attributes both listings share", () => {
    const target = listing({ id: "target", provider: econet, attributes: { data_amount: 5, validity_days: 30 } });
    // Only has data_amount — validity_days is simply absent, not zero.
    const sparse = listing({ id: "sparse", provider: netone, attributes: { data_amount: 5 } });

    const [match] = findClosestMatches(target, [sparse], dataBundleSchema);
    expect(match.listing.id).toBe("sparse");
    expect(match.similarity).toBe(100);
  });

  it("filters out weak matches below the similarity floor and respects the limit", () => {
    const target = listing({ id: "target", provider: econet, attributes: { data_amount: 5, validity_days: 30 } });
    const weak = listing({ id: "weak", provider: netone, attributes: { data_amount: 1000, validity_days: 1 } });
    const strong1 = listing({ id: "strong1", provider: telecel, attributes: { data_amount: 5, validity_days: 30 } });
    const strong2 = listing({
      id: "strong2",
      provider: { id: "cbz", name: "CBZ", logoUrl: null, verified: true, websiteUrl: null },
      attributes: { data_amount: 6, validity_days: 30 },
    });

    const matches = findClosestMatches(target, [weak, strong1, strong2], dataBundleSchema, 1);
    expect(matches).toHaveLength(1);
    expect(matches.some((m) => m.listing.id === "weak")).toBe(false);
    expect(matches[0].listing.id).toBe("strong1");
  });
});
