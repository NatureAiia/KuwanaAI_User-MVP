import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { listingUpdateLog: { findMany } } }));

const { getRecentListingActivity } = await import("@/lib/liveFeed");

describe("getRecentListingActivity", () => {
  it("scopes the query to the given provider's own listings", async () => {
    findMany.mockResolvedValue([]);
    await getRecentListingActivity("prov1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { listing: { providerId: "prov1" } } }),
    );
  });

  it("orders results newest-first and respects the limit argument", async () => {
    findMany.mockResolvedValue([]);
    await getRecentListingActivity("prov1", 5);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 5 }),
    );
  });

  it("defaults to a limit of 30 when none is given", async () => {
    findMany.mockResolvedValue([]);
    await getRecentListingActivity("prov1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 30 }));
  });

  it("flattens the joined listing name onto each entry", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    findMany.mockResolvedValue([
      {
        id: "log1",
        listingId: "listing1",
        listing: { name: "Econet 20GB" },
        source: "admin",
        actorLabel: "Jane (admin)",
        changeSummary: "Price changed from $10 to $12",
        createdAt,
      },
    ]);

    const result = await getRecentListingActivity("prov1");
    expect(result).toEqual([
      {
        id: "log1",
        listingId: "listing1",
        listingName: "Econet 20GB",
        source: "admin",
        actorLabel: "Jane (admin)",
        changeSummary: "Price changed from $10 to $12",
        createdAt,
      },
    ]);
  });

  it("returns an empty array when the provider has no logged activity", async () => {
    findMany.mockResolvedValue([]);
    const result = await getRecentListingActivity("prov1");
    expect(result).toEqual([]);
  });
});
