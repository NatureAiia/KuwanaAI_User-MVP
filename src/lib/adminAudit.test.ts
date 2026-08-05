import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { adminAuditLog: { create } },
}));

const { logAdminAction } = await import("@/lib/adminAudit");

beforeEach(() => {
  create.mockReset();
});

describe("logAdminAction", () => {
  it("writes exactly the given fields, no silent defaults or omissions", async () => {
    await logAdminAction({
      adminEmail: "admin@example.com",
      action: "listing_approved",
      targetType: "listing",
      targetId: "listing-1",
      detail: 'Approved "Gold Savings Account"',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        adminEmail: "admin@example.com",
        action: "listing_approved",
        targetType: "listing",
        targetId: "listing-1",
        detail: 'Approved "Gold Savings Account"',
      },
    });
  });
});
