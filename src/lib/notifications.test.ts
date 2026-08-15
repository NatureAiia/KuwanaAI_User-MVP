import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const findUniquePreference = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { notification: { upsert }, notificationPreference: { findUnique: findUniquePreference } },
}));

const { notifyListingDecision } = await import("@/lib/notifications");

beforeEach(() => {
  upsert.mockReset();
  findUniquePreference.mockReset();
  // No row = not yet toggled = on by default (see notificationPreferences.ts).
  findUniquePreference.mockResolvedValue(null);
});

describe("notifyListingDecision", () => {
  it("upserts a listing_approved notification keyed to the provider's owner", async () => {
    await notifyListingDecision({
      listingId: "listing-1",
      ownerUserId: "owner-1",
      listingName: "Gold Savings Account",
      status: "published",
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_listingId_type: { userId: "owner-1", listingId: "listing-1", type: "listing_approved" } },
      }),
    );
    const call = upsert.mock.calls[0][0];
    expect(call.create.message).toContain("Gold Savings Account");
    expect(call.create.message).toContain("approved");
  });

  it("upserts a listing_rejected notification that includes the rejection reason", async () => {
    await notifyListingDecision({
      listingId: "listing-2",
      ownerUserId: "owner-2",
      listingName: "Bronze Plan",
      status: "rejected",
      rejectionReason: "Price doesn't match the source URL",
    });

    const call = upsert.mock.calls[0][0];
    expect(call.where).toEqual({
      userId_listingId_type: { userId: "owner-2", listingId: "listing-2", type: "listing_rejected" },
    });
    expect(call.create.message).toContain("Bronze Plan");
    expect(call.create.message).toContain("Price doesn't match the source URL");
  });

  it("still produces a sensible message when a rejection has no reason", async () => {
    await notifyListingDecision({
      listingId: "listing-3",
      ownerUserId: "owner-3",
      listingName: "Silver Plan",
      status: "rejected",
      rejectionReason: null,
    });

    const call = upsert.mock.calls[0][0];
    expect(call.create.message).toBe('"Silver Plan" was rejected.');
  });
});
