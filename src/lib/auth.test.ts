import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique } },
}));

const { requireUser, getUserRole, requireConsumer, requireAdmin, isAllowlistedAdmin } = await import("@/lib/auth");

const originalAdminEmails = process.env.ADMIN_EMAILS;

beforeEach(() => {
  getUser.mockReset();
  findUnique.mockReset();
});

afterEach(() => {
  process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe("requireUser", () => {
  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await requireUser()).toBeNull();
  });

  it("returns the user when a session exists", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    expect(await requireUser()).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("returns the user when their row exists and the email is verified", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ accountStatus: "active", emailVerifiedAt: new Date() });
    expect(await requireUser()).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("rejects a row whose email was never verified", async () => {
    // Gated here rather than per route: eleven routes call requireUser()
    // directly with no role check on top, wallet top-up among them.
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ accountStatus: "active", emailVerifiedAt: null });
    expect(await requireUser()).toBeNull();
  });

  it("still admits a session with no row at all — that is mid-signup", async () => {
    // /api/onboarding is the thing that creates the row, and it calls
    // requireUser() first. Refusing here would make signup impossible.
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue(null);
    expect(await requireUser()).toEqual({ id: "u1", email: "a@b.com" });
  });

  it("rejects a suspended account even when its email is verified", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ accountStatus: "suspended", emailVerifiedAt: new Date() });
    expect(await requireUser()).toBeNull();
  });
});

describe("getUserRole", () => {
  it("returns null when the user has no row in the DB", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getUserRole("missing")).toBeNull();
  });

  it("returns the role when found", async () => {
    findUnique.mockResolvedValue({ role: "corporate" });
    expect(await getUserRole("u1")).toBe("corporate");
  });
});

describe("requireConsumer", () => {
  it("returns a 401 response when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await requireConsumer();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(401);
  });

  // One `findUnique` mock serves both lookups requireConsumer makes — the
  // account-status/verification read in requireUser and the role read in
  // getUserRole — so the fixture has to satisfy both.
  it("returns a 403 response when authenticated but not a consumer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "regulator", accountStatus: "active", emailVerifiedAt: new Date() });
    const result = await requireConsumer();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(403);
  });

  it("returns the user when authenticated as a consumer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "consumer", accountStatus: "active", emailVerifiedAt: new Date() });
    const result = await requireConsumer();
    expect("user" in result).toBe(true);
    if ("user" in result) expect(result.user.id).toBe("u1");
  });

  it("returns a 401, not a 403, for a consumer whose email is unverified", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "consumer", accountStatus: "active", emailVerifiedAt: null });
    const result = await requireConsumer();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(401);
  });
});

describe("requireAdmin", () => {
  it("returns null when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await requireAdmin()).toBeNull();
  });

  it("returns null when the user's email isn't on the allowlist", async () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "admin@example.com" } } });
    expect(await requireAdmin()).toBeNull();
  });

  it("returns the user when their email is on the allowlist, case-insensitively", async () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com, other@example.com";
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "admin@example.com" } } });
    const result = await requireAdmin();
    expect(result?.id).toBe("u1");
  });

  it("returns null when ADMIN_EMAILS is unset (fails closed, not open)", async () => {
    delete process.env.ADMIN_EMAILS;
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "admin@example.com" } } });
    expect(await requireAdmin()).toBeNull();
  });
});

describe("isAllowlistedAdmin", () => {
  it("returns false when the email is null/undefined", () => {
    expect(isAllowlistedAdmin(null)).toBe(false);
    expect(isAllowlistedAdmin(undefined)).toBe(false);
  });

  it("returns false when ADMIN_EMAILS is unset (fails closed, not open)", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAllowlistedAdmin("admin@example.com")).toBe(false);
  });

  it("returns false when the email isn't on the allowlist", () => {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    expect(isAllowlistedAdmin("admin@example.com")).toBe(false);
  });

  it("returns true when the email is on the allowlist, case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Admin@Example.com, other@example.com";
    expect(isAllowlistedAdmin("admin@example.com")).toBe(true);
  });
});
