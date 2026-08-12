import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstProvider = vi.fn();
const findFirstListing = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findFirst: findFirstProvider },
    listing: { findFirst: findFirstListing },
  },
}));

const { suggestMatch } = await import("@/lib/scrape/match");

beforeEach(() => {
  findFirstProvider.mockReset();
  findFirstListing.mockReset();
});

describe("suggestMatch", () => {
  it("returns nothing when there is no provider name guess at all", async () => {
    const result = await suggestMatch({ providerNameGuess: null, categoryId: "cat-1", listingNameGuess: "Plan" });
    expect(result).toEqual({ providerId: null, listingId: null });
    expect(findFirstProvider).not.toHaveBeenCalled();
  });

  it("returns nothing when no provider matches the guessed name", async () => {
    findFirstProvider.mockResolvedValue(null);
    const result = await suggestMatch({ providerNameGuess: "Nonexistent Co", categoryId: "cat-1", listingNameGuess: "Plan" });
    expect(result).toEqual({ providerId: null, listingId: null });
    expect(findFirstListing).not.toHaveBeenCalled();
  });

  it("matches a provider case-insensitively but skips the listing lookup without a categoryId", async () => {
    findFirstProvider.mockResolvedValue({ id: "provider-1" });
    const result = await suggestMatch({ providerNameGuess: "econet", categoryId: null, listingNameGuess: "Plan" });
    expect(result).toEqual({ providerId: "provider-1", listingId: null });
    expect(findFirstProvider).toHaveBeenCalledWith({
      where: { name: { equals: "econet", mode: "insensitive" } },
    });
    expect(findFirstListing).not.toHaveBeenCalled();
  });

  it("suggests an existing listing when the provider, category and name all match", async () => {
    findFirstProvider.mockResolvedValue({ id: "provider-1" });
    findFirstListing.mockResolvedValue({ id: "listing-1" });
    const result = await suggestMatch({
      providerNameGuess: "Econet",
      categoryId: "cat-1",
      listingNameGuess: "EcoData 5GB",
    });
    expect(result).toEqual({ providerId: "provider-1", listingId: "listing-1" });
    expect(findFirstListing).toHaveBeenCalledWith({
      where: {
        providerId: "provider-1",
        categoryId: "cat-1",
        name: { equals: "EcoData 5GB", mode: "insensitive" },
      },
    });
  });

  it("matches the provider but not the listing when no listing has that name yet", async () => {
    findFirstProvider.mockResolvedValue({ id: "provider-1" });
    findFirstListing.mockResolvedValue(null);
    const result = await suggestMatch({
      providerNameGuess: "Econet",
      categoryId: "cat-1",
      listingNameGuess: "Brand New Bundle",
    });
    expect(result).toEqual({ providerId: "provider-1", listingId: null });
  });
});
