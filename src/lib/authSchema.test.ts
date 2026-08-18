import { describe, expect, it } from "vitest";
import { loginSchema, passwordSchema, registerSchema } from "@/lib/authSchema";

describe("passwordSchema", () => {
  it("rejects a password one character under the minimum", () => {
    expect(passwordSchema.safeParse("a".repeat(9)).success).toBe(false);
  });

  it("accepts a password at exactly the minimum", () => {
    expect(passwordSchema.safeParse("a".repeat(10)).success).toBe(true);
  });

  it("rejects a password over bcrypt's 72-byte limit", () => {
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });

  it("accepts a password at exactly 72 characters", () => {
    expect(passwordSchema.safeParse("a".repeat(72)).success).toBe(true);
  });

  it("rejects leading/trailing whitespace", () => {
    expect(passwordSchema.safeParse(" goodpassword123").success).toBe(false);
    expect(passwordSchema.safeParse("goodpassword123 ").success).toBe(false);
  });

  it("rejects a common password even if long enough", () => {
    expect(passwordSchema.safeParse("password123").success).toBe(false);
  });

  it("accepts a reasonable, uncommon password", () => {
    expect(passwordSchema.safeParse("correct-battery-staple-9").success).toBe(true);
  });
});

describe("registerSchema", () => {
  it("rejects a password containing the email's local part", () => {
    const result = registerSchema.safeParse({ email: "arthur@example.com", password: "arthurarthur1" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid email/password pair unrelated to each other", () => {
    const result = registerSchema.safeParse({ email: "arthur@example.com", password: "a-totally-unrelated-9" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(registerSchema.safeParse({ email: "not-an-email", password: "a-totally-unrelated-9" }).success).toBe(
      false,
    );
  });
});

describe("loginSchema", () => {
  it("accepts a short, pre-policy legacy password — deliberately not passwordSchema", () => {
    // An account created before this policy existed must still be able to
    // log in with whatever password it already has.
    expect(loginSchema.safeParse({ email: "old@example.com", password: "short" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "old@example.com", password: "" }).success).toBe(false);
  });

  it("rejects a password over the 72-byte sanity bound", () => {
    expect(loginSchema.safeParse({ email: "old@example.com", password: "a".repeat(73) }).success).toBe(false);
  });
});
