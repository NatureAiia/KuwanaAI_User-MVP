import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique } },
}));

const { requireUser, getUserRole, requireConsumer, requireConsumerOrProvider, requireAdmin } =
  await import("@/lib/auth");

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

  it("returns a 403 response when authenticated but not a consumer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "regulator" });
    const result = await requireConsumer();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(403);
  });

  it("returns the user when authenticated as a consumer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "consumer" });
    const result = await requireConsumer();
    expect("user" in result).toBe(true);
    if ("user" in result) expect(result.user.id).toBe("u1");
  });
});

describe("requireConsumerOrProvider", () => {
  it("returns a 401 response when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await requireConsumerOrProvider();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(401);
  });

  it("returns a 403 response for a role with no notifications concept, e.g. corporate", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "corporate" });
    const result = await requireConsumerOrProvider();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(403);
  });

  it("returns the user for a consumer", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "consumer" });
    const result = await requireConsumerOrProvider();
    expect("user" in result).toBe(true);
  });

  it("returns the user for a provider", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    findUnique.mockResolvedValue({ role: "provider" });
    const result = await requireConsumerOrProvider();
    expect("user" in result).toBe(true);
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
