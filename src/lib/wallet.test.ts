import { beforeEach, describe, expect, it, vi } from "vitest";

const userUpdate = vi.fn();
const walletTransactionUpdate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (db: unknown) => Promise<unknown>) =>
      callback({ user: { update: userUpdate }, walletTransaction: { update: walletTransactionUpdate } }),
    ),
  },
}));

const { applyPaynowStatusUpdate } = await import("@/lib/wallet");

beforeEach(() => {
  userUpdate.mockReset();
  walletTransactionUpdate.mockReset();
});

function tx(overrides: Partial<Parameters<typeof applyPaynowStatusUpdate>[0]> = {}) {
  return {
    id: "tx-1",
    userId: "user-1",
    currency: "USD" as const,
    amount: 10,
    status: "pending",
    ...overrides,
  };
}

describe("applyPaynowStatusUpdate", () => {
  it("credits walletBalanceUsd when a USD transaction flips to paid", async () => {
    await applyPaynowStatusUpdate(tx({ currency: "USD" }), { status: "Paid" });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { walletBalanceUsd: { increment: 10 } },
    });
  });

  it("credits walletBalanceZig, not walletBalanceUsd, for a ZiG transaction", async () => {
    await applyPaynowStatusUpdate(tx({ currency: "ZiG" }), { status: "Paid" });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { walletBalanceZig: { increment: 10 } },
    });
  });

  it("does not credit the balance again if the transaction is already paid (idempotency)", async () => {
    await applyPaynowStatusUpdate(tx({ status: "paid" }), { status: "Paid" });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("does not credit the balance for a non-paid status", async () => {
    await applyPaynowStatusUpdate(tx({ status: "pending" }), { status: "Cancelled" });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("always records the raw Paynow status and reference on the transaction row", async () => {
    await applyPaynowStatusUpdate(tx(), { status: "Cancelled", paynowreference: "PN-1" });

    expect(walletTransactionUpdate).toHaveBeenCalledWith({
      where: { id: "tx-1" },
      data: { status: "cancelled", paynowStatus: "Cancelled", paynowReference: "PN-1" },
    });
  });

  it("returns the normalized status", async () => {
    const result = await applyPaynowStatusUpdate(tx(), { status: "Awaiting Delivery" });
    expect(result).toBe("paid");
  });
});
