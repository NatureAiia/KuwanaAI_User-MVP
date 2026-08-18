import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const create = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const deleteMany = vi.fn();

const client = {
  emailVerificationCode: { findFirst, create, update, updateMany, deleteMany },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
};

vi.mock("@/lib/prisma", () => ({ prisma: client }));

const {
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  hasVerifiedEmail,
  hashCode,
  isValidCodeFormat,
  issueVerificationCode,
  mintCode,
  normalizeEmail,
  purgeStaleVerificationCodes,
  RETENTION_DAYS,
  verifyCode,
} = await import("@/lib/email/verification");

const USER = "user-1";
const EMAIL = "person@example.com";

beforeEach(() => {
  findFirst.mockReset();
  create.mockReset();
  update.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
  updateMany.mockResolvedValue({ count: 1 });
  process.env.EMAIL_VERIFICATION_SECRET = "test-secret";
});

/** A live, unconsumed code row for `code`. */
function row(code: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "code-1",
    userId: USER,
    email: EMAIL,
    codeHash: hashCode(USER, EMAIL, code),
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("mintCode", () => {
  it("always produces exactly six digits", () => {
    for (let i = 0; i < 500; i++) expect(mintCode()).toMatch(/^\d{6}$/);
  });

  it("keeps leading zeros, which a numeric code would silently drop", () => {
    // Codes are strings for this reason; 42 must present as "000042", not "42".
    expect(isValidCodeFormat("000042")).toBe(true);
    expect(isValidCodeFormat("42")).toBe(false);
  });

  it("rejects anything that isn't six digits", () => {
    for (const bad of ["", "12345", "1234567", "12a456", " 123456", "123 456"]) {
      expect(isValidCodeFormat(bad)).toBe(false);
    }
  });
});

describe("hashCode", () => {
  it("is deterministic for the same user, email and code", () => {
    expect(hashCode(USER, EMAIL, "123456")).toBe(hashCode(USER, EMAIL, "123456"));
  });

  it("never stores the code itself", () => {
    expect(hashCode(USER, EMAIL, "123456")).not.toContain("123456");
  });

  it("binds the hash to the user, so a code cannot be replayed against another account", () => {
    expect(hashCode(USER, EMAIL, "123456")).not.toBe(hashCode("user-2", EMAIL, "123456"));
  });

  it("binds the hash to the email, so a code survives no change of address", () => {
    expect(hashCode(USER, EMAIL, "123456")).not.toBe(hashCode(USER, "other@example.com", "123456"));
  });

  it("is keyed — the same code under a different server secret hashes differently", () => {
    // The whole reason for HMAC over a bare digest: six digits is 10^6
    // possibilities, so an unkeyed hash column is a lookup table, not a secret.
    const withFirstKey = hashCode(USER, EMAIL, "123456");
    process.env.EMAIL_VERIFICATION_SECRET = "a-different-secret";
    expect(hashCode(USER, EMAIL, "123456")).not.toBe(withFirstKey);
  });

  it("normalizes the email, so casing from a mail client can't break a match", () => {
    expect(hashCode(USER, " Person@Example.COM ", "123456")).toBe(hashCode(USER, EMAIL, "123456"));
  });

  it("refuses to hash with no key at all rather than falling back to something weaker", () => {
    delete process.env.EMAIL_VERIFICATION_SECRET;
    const authSecret = process.env.AUTH_SECRET;
    delete process.env.AUTH_SECRET;
    expect(() => hashCode(USER, EMAIL, "123456")).toThrow(/EMAIL_VERIFICATION_SECRET/);
    if (authSecret !== undefined) process.env.AUTH_SECRET = authSecret;
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe(EMAIL);
  });
});

describe("issueVerificationCode", () => {
  it("stores a hash, never the plaintext code", async () => {
    const code = await issueVerificationCode(USER, EMAIL);
    const stored = create.mock.calls[0][0].data;
    expect(stored.codeHash).toBe(hashCode(USER, EMAIL, code));
    expect(JSON.stringify(stored)).not.toContain(code);
  });

  it("expires any code already outstanding, so resending doesn't multiply the attempt budget", async () => {
    await issueVerificationCode(USER, EMAIL);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: USER, consumedAt: null }) }),
    );
  });

  it("sets an expiry of CODE_TTL_MINUTES from now", async () => {
    const before = Date.now();
    await issueVerificationCode(USER, EMAIL);
    const { expiresAt } = create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + CODE_TTL_MINUTES * 60_000 - 1_000);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + CODE_TTL_MINUTES * 60_000);
  });

  it("stores the normalized email so lookup by the same address matches", async () => {
    await issueVerificationCode(USER, " Person@Example.COM ");
    expect(create.mock.calls[0][0].data.email).toBe(EMAIL);
  });
});

describe("verifyCode", () => {
  it("accepts the right code", async () => {
    findFirst.mockResolvedValue(row("123456"));
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({ ok: true });
  });

  it("marks the code consumed, so it cannot be used twice", async () => {
    findFirst.mockResolvedValue(row("123456"));
    await verifyCode(USER, EMAIL, "123456");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "code-1", consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it("loses a race for the same code — only one caller consumes it", async () => {
    findFirst.mockResolvedValue(row("123456"));
    // The filtered update matched no row: another request got there first.
    updateMany.mockResolvedValue({ count: 0 });
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({ ok: false, reason: "no_code" });
  });

  it("rejects a wrong code and spends an attempt", async () => {
    findFirst.mockResolvedValue(row("123456"));
    await expect(verifyCode(USER, EMAIL, "999999")).resolves.toEqual({ ok: false, reason: "mismatch" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "code-1" },
      data: { attempts: { increment: 1 } },
    });
  });

  it("does not consume the code when the guess is wrong", async () => {
    findFirst.mockResolvedValue(row("123456"));
    await verifyCode(USER, EMAIL, "999999");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("rejects an expired code without spending an attempt", async () => {
    findFirst.mockResolvedValue(row("123456", { expiresAt: new Date(Date.now() - 1) }));
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({ ok: false, reason: "expired" });
    expect(update).not.toHaveBeenCalled();
  });

  it("stops accepting guesses once the attempt budget is spent, even a correct one", async () => {
    // Bounds the 10^6 space: without this, a live code is walkable.
    findFirst.mockResolvedValue(row("123456", { attempts: MAX_ATTEMPTS }));
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({
      ok: false,
      reason: "too_many_attempts",
    });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("reports no_code when nothing was ever issued", async () => {
    findFirst.mockResolvedValue(null);
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({ ok: false, reason: "no_code" });
  });

  it("only ever looks at unconsumed codes for this user and address", async () => {
    findFirst.mockResolvedValue(null);
    await verifyCode(USER, " Person@Example.COM ", "123456");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER, email: EMAIL, consumedAt: null } }),
    );
  });

  it("takes the newest code when several exist", async () => {
    findFirst.mockResolvedValue(null);
    await verifyCode(USER, EMAIL, "123456");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("rejects a code minted for a different address", async () => {
    // The row is found (same user), but its hash is bound to another email.
    findFirst.mockResolvedValue({
      ...row("123456"),
      codeHash: hashCode(USER, "someone-else@example.com", "123456"),
    });
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects a corrupt stored hash instead of throwing on the length check", async () => {
    // timingSafeEqual throws on unequal lengths — a truncated column must
    // fail the comparison, not crash the route.
    findFirst.mockResolvedValue(row("123456", { codeHash: "abcd" }));
    await expect(verifyCode(USER, EMAIL, "123456")).resolves.toEqual({ ok: false, reason: "mismatch" });
  });
});

describe("hasVerifiedEmail", () => {
  it("is true once a code for this address has been consumed", async () => {
    findFirst.mockResolvedValue({ id: "code-1" });
    await expect(hasVerifiedEmail(USER, EMAIL)).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, email: EMAIL, consumedAt: { not: null } },
      }),
    );
  });

  it("is false when nothing was ever confirmed", async () => {
    findFirst.mockResolvedValue(null);
    await expect(hasVerifiedEmail(USER, EMAIL)).resolves.toBe(false);
  });
});

describe("purgeStaleVerificationCodes", () => {
  it("deletes only rows older than the retention window", async () => {
    // Deleting on expiry instead would un-verify anyone who paused mid-signup,
    // since hasVerifiedEmail() reads consumed rows back.
    deleteMany.mockResolvedValue({ count: 7 });
    const before = Date.now();
    await expect(purgeStaleVerificationCodes()).resolves.toEqual({ deleted: 7 });

    const cutoff = deleteMany.mock.calls[0][0].where.createdAt.lt as Date;
    const expected = before - RETENTION_DAYS * 24 * 60 * 60_000;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(expected - 1_000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(expected + 1_000);
  });
});
