import { describe, expect, it } from "vitest";
import { adminUserUpdateSchema } from "@/lib/adminUserSchema";

describe("adminUserUpdateSchema", () => {
  it.each(["consumer", "corporate", "regulator", "provider"])("accepts role: %s", (role) => {
    expect(adminUserUpdateSchema.safeParse({ role }).success).toBe(true);
  });

  it.each(["admin", "superuser", ""])("rejects role: %s", (role) => {
    expect(adminUserUpdateSchema.safeParse({ role }).success).toBe(false);
  });

  it("rejects a missing role", () => {
    expect(adminUserUpdateSchema.safeParse({}).success).toBe(false);
  });
});
