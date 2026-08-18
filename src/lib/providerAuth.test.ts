import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const userFindUnique = vi.fn();
const providerFindUnique = vi.fn();
const providerMemberFindUnique = vi.fn();

vi.mock("@/lib/nextAuth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    provider: { findUnique: providerFindUnique },
    providerMember: { findUnique: providerMemberFindUnique },
  },
}));

const { requireOwnProvider } = await import("@/lib/providerAuth");

beforeEach(() => {
  authMock.mockReset();
  userFindUnique.mockReset();
  providerFindUnique.mockReset();
  providerMemberFindUnique.mockReset();
  providerMemberFindUnique.mockResolvedValue(null);
});

// The one `user.findUnique` mock answers both lookups behind
// requireOwnProvider: requireUser's account-status/email-verification read
// and getUserRole's role read. Fixtures below carry all three fields.

describe("requireOwnProvider", () => {
  it("returns a 401 when unauthenticated", async () => {
    authMock.mockResolvedValue({ user: null });
    const result = await requireOwnProvider();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(401);
  });

  it("returns a 403 when authenticated but not a provider account", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    userFindUnique.mockResolvedValue({ role: "consumer", accountStatus: "active", emailVerifiedAt: new Date() });
    const result = await requireOwnProvider();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(403);
  });

  it("returns a 404 when a provider account has no linked Provider record", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    userFindUnique.mockResolvedValue({ role: "provider", accountStatus: "active", emailVerifiedAt: new Date() });
    providerFindUnique.mockResolvedValue(null);
    const result = await requireOwnProvider();
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(404);
  });

  it("returns the caller's own provider, never one it merely asserts", async () => {
    authMock.mockResolvedValue({ user: { id: "u1", email: "a@b.com" } });
    userFindUnique.mockResolvedValue({ role: "provider", accountStatus: "active", emailVerifiedAt: new Date() });
    providerFindUnique.mockResolvedValue({ id: "prov-1", name: "Test Co" });
    const result = await requireOwnProvider();
    expect("provider" in result).toBe(true);
    if ("provider" in result) {
      expect(result.provider.id).toBe("prov-1");
      expect(result.isOwner).toBe(true);
      // Confirms the lookup is keyed by the authenticated user's own id, not
      // anything client-supplied.
      expect(providerFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerUserId: "u1" } }),
      );
    }
  });

  it("returns the provider for an invited teammate, with isOwner false", async () => {
    authMock.mockResolvedValue({ user: { id: "u2", email: "teammate@b.com" } });
    userFindUnique.mockResolvedValue({ role: "provider", accountStatus: "active", emailVerifiedAt: new Date() });
    providerFindUnique.mockResolvedValue(null);
    providerMemberFindUnique.mockResolvedValue({ provider: { id: "prov-1", name: "Test Co" } });
    const result = await requireOwnProvider();
    expect("provider" in result).toBe(true);
    if ("provider" in result) {
      expect(result.provider.id).toBe("prov-1");
      expect(result.isOwner).toBe(false);
    }
  });
});
