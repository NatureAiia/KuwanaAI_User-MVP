import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for a finding from the 2026-08-17 security audit
// (security/resilience-audit branch): this route's `findUnique`/`update`
// calls used to fetch the full ApiKey row — including `hashedKey` — and
// return it straight to the client. The sibling GET in `api-keys/route.ts`
// already scoped its `select`; this route just hadn't gotten the same
// treatment. Asserts both that hashedKey never appears in the response body
// and that the query itself never asks Prisma for it, so a future change
// that adds a field to the row can't reintroduce the leak by accident.

const findUnique = vi.fn();
const update = vi.fn();
const requireAdmin = vi.fn();
const logAdminAction = vi.fn();

vi.mock("@/lib/auth", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/lib/prisma", () => ({ prisma: { apiKey: { findUnique, update } } }));
vi.mock("@/lib/adminAudit", () => ({ logAdminAction }));

const { PATCH } = await import("./route");

const params = Promise.resolve({ id: "key-1" });

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  requireAdmin.mockReset();
  logAdminAction.mockReset();
  requireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@kuwana.ai" });
});

describe("PATCH /api/admin/api-keys/[id]", () => {
  it("never returns hashedKey in the revoked response", async () => {
    findUnique.mockResolvedValue({
      id: "key-1",
      label: "BI export",
      scopes: ["read:catalog"],
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });
    update.mockResolvedValue({
      id: "key-1",
      label: "BI export",
      scopes: ["read:catalog"],
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: new Date(),
    });

    const res = await PATCH(new Request("https://kuwana.ai"), { params });
    const body = await res.json();

    expect(body.apiKey).not.toHaveProperty("hashedKey");
  });

  it("never asks Prisma to select hashedKey in the first place", async () => {
    findUnique.mockResolvedValue({
      id: "key-1",
      label: "BI export",
      scopes: [],
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });
    update.mockResolvedValue({});

    await PATCH(new Request("https://kuwana.ai"), { params });

    const findArgs = findUnique.mock.calls[0][0];
    const updateArgs = update.mock.calls[0][0];
    expect(findArgs.select?.hashedKey).toBeUndefined();
    expect(updateArgs.select?.hashedKey).toBeUndefined();
  });

  it("returns the already-revoked row unchanged without a redundant write", async () => {
    const revokedAt = new Date();
    findUnique.mockResolvedValue({
      id: "key-1",
      label: "BI export",
      scopes: [],
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt,
    });

    const res = await PATCH(new Request("https://kuwana.ai"), { params });
    const body = await res.json();

    expect(update).not.toHaveBeenCalled();
    expect(body.apiKey.revokedAt).toEqual(revokedAt.toISOString());
    expect(body.apiKey).not.toHaveProperty("hashedKey");
  });
});
