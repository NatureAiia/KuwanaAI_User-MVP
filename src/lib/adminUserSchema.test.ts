import { describe, expect, it } from "vitest";
import { adminUserUpdateSchema } from "@/lib/adminUserSchema";

describe("adminUserUpdateSchema", () => {
  it.each(["consumer", "corporate", "regulator", "provider"])("accepts role: %s", (role) => {
    expect(adminUserUpdateSchema.safeParse({ role }).success).toBe(true);
  });

  it.each(["admin", "superuser", ""])("rejects role: %s", (role) => {
    expect(adminUserUpdateSchema.safeParse({ role }).success).toBe(false);
  });

  it("rejects an empty body (neither role nor accountStatus)", () => {
    expect(adminUserUpdateSchema.safeParse({}).success).toBe(false);
  });

  it.each(["active", "suspended"])("accepts accountStatus: %s", (accountStatus) => {
    expect(adminUserUpdateSchema.safeParse({ accountStatus }).success).toBe(true);
  });

  it("rejects an invalid accountStatus", () => {
    expect(adminUserUpdateSchema.safeParse({ accountStatus: "banned" }).success).toBe(false);
  });

  it("accepts accountStatus with a suspendedReason", () => {
    expect(
      adminUserUpdateSchema.safeParse({ accountStatus: "suspended", suspendedReason: "Repeated fraud reports" })
        .success,
    ).toBe(true);
  });

  it("accepts role and accountStatus together", () => {
    expect(adminUserUpdateSchema.safeParse({ role: "consumer", accountStatus: "suspended" }).success).toBe(true);
  });

  it.each(["keep", "remove"])("accepts listingAction: %s", (listingAction) => {
    expect(adminUserUpdateSchema.safeParse({ accountStatus: "suspended", listingAction }).success).toBe(true);
  });

  it("rejects an invalid listingAction", () => {
    expect(adminUserUpdateSchema.safeParse({ accountStatus: "suspended", listingAction: "archive" }).success).toBe(
      false,
    );
  });
});
