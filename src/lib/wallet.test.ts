import { beforeEach, describe, expect, it, vi } from "vitest";

const userUpdate = vi.fn();
const walletTransactionUpdate = vi.fn();
const walletTransactionUpdateMany = vi.fn();
// The amount-mismatch path writes outside $transaction (it credits nothing, so
// there is nothing to make atomic), so the mock has to expose the same
// delegate at the top level as well as inside the callback.
const topLevelUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    walletTransaction: { updateMany: topLevelUpdateMany },
    $transaction: vi.fn(async (callback: (db: unknown) => Promise<unknown>) =>
      callback({
        user: { update: userUpdate },
        walletTransaction: { update: walletTransactionUpdate, updateMany: walletTransactionUpdateMany },
      }),
    ),
  },
}));

const { applyPaynowStatusUpdate } = await import("@/lib/wallet");

beforeEach(() => {
  userUpdate.mockReset();
  walletTransactionUpdate.mockReset();
  walletTransactionUpdateMany.mockReset();
  topLevelUpdateMany.mockReset();
  walletTransactionUpdateMany.mockResolvedValue({ count: 1 });
  topLevelUpdateMany.mockResolvedValue({ count: 1 });
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

    expect(walletTransactionUpdateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", status: { not: "paid" } },
      data: { status: "paid", paynowStatus: "Paid", paynowReference: undefined },
    });
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
    walletTransactionUpdateMany.mockResolvedValue({ count: 0 });

    await applyPaynowStatusUpdate(tx({ status: "paid" }), { status: "Paid" });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("does not double-credit when a concurrent call already claimed the update (count: 0)", async () => {
    walletTransactionUpdateMany.mockResolvedValue({ count: 0 });

    await applyPaynowStatusUpdate(tx({ status: "pending" }), { status: "Paid" });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("does not credit the balance for a non-paid status", async () => {
    await applyPaynowStatusUpdate(tx({ status: "pending" }), { status: "Cancelled" });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("decrements walletBalanceUsd when a paid USD transaction is refunded", async () => {
    await applyPaynowStatusUpdate(tx({ currency: "USD", status: "paid" }), { status: "Refunded" });

    expect(walletTransactionUpdateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", status: "paid" },
      data: { status: "refunded", paynowStatus: "Refunded", paynowReference: undefined },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { walletBalanceUsd: { decrement: 10 } },
    });
  });

  it("decrements walletBalanceZig, not walletBalanceUsd, when a paid ZiG transaction is refunded", async () => {
    await applyPaynowStatusUpdate(tx({ currency: "ZiG", status: "paid" }), { status: "Refunded" });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { walletBalanceZig: { decrement: 10 } },
    });
  });

  it("does not reverse the balance again if the transaction is not currently paid (refund idempotency)", async () => {
    walletTransactionUpdateMany.mockResolvedValue({ count: 0 });

    await applyPaynowStatusUpdate(tx({ status: "refunded" }), { status: "Refunded" });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("always records the raw Paynow status and reference on the transaction row for non-paid/refunded statuses", async () => {
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

describe("applyPaynowStatusUpdate — reported amount", () => {
  it("credits when the reported amount matches the requested amount", async () => {
    await applyPaynowStatusUpdate(tx({ amount: 10 }), { status: "Paid", amount: "10.00" });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { walletBalanceUsd: { increment: 10 } },
    });
  });

  it("credits nothing when the customer short-pays", async () => {
    const result = await applyPaynowStatusUpdate(tx({ amount: 100 }), { status: "Paid", amount: "1.00" });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(result).toBe("failed");
  });

  it("does not credit the smaller amount either — a short payment is not a discount", async () => {
    await applyPaynowStatusUpdate(tx({ amount: 100 }), { status: "Paid", amount: "1.00" });

    // Not "increment: 1" and not "increment: 100" — nothing at all.
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("marks the mismatched transaction failed with a reason an admin can act on", async () => {
    await applyPaynowStatusUpdate(tx({ amount: 100 }), { status: "Paid", amount: "1.00" });

    expect(topLevelUpdateMany).toHaveBeenCalledWith({
      where: { id: "tx-1", status: { not: "paid" } },
      data: expect.objectContaining({
        status: "failed",
        failureReason: expect.stringContaining("Amount mismatch"),
      }),
    });
  });

  it("credits nothing when the customer over-pays", async () => {
    const result = await applyPaynowStatusUpdate(tx({ amount: 10 }), { status: "Paid", amount: "500.00" });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(result).toBe("failed");
  });

  it("accepts trailing-zero differences — 10.1 and 10.10 are the same money", async () => {
    await applyPaynowStatusUpdate(tx({ amount: 10.1 }), { status: "Paid", amount: "10.10" });

    expect(userUpdate).toHaveBeenCalled();
  });

  it("rejects a one-cent discrepancy rather than rounding it away", async () => {
    const result = await applyPaynowStatusUpdate(tx({ amount: 10 }), { status: "Paid", amount: "9.99" });

    expect(result).toBe("failed");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric reported amount instead of treating NaN as a match", async () => {
    const result = await applyPaynowStatusUpdate(tx({ amount: 10 }), { status: "Paid", amount: "abc" });

    expect(result).toBe("failed");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("still credits when no amount is reported at all — the poll fallback carries none", async () => {
    // pollTransactionStatus returns only { status, paynowReference }. Failing
    // closed here would disable the fallback that exists for when the webhook
    // never arrives, so an absent amount is not a mismatch.
    await applyPaynowStatusUpdate(tx({ amount: 10 }), { status: "Paid" });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { walletBalanceUsd: { increment: 10 } },
    });
  });

  it("ignores the reported amount for a non-paid status", async () => {
    const result = await applyPaynowStatusUpdate(tx(), { status: "Cancelled", amount: "0.00" });

    expect(result).toBe("cancelled");
    expect(topLevelUpdateMany).not.toHaveBeenCalled();
  });

  it("does not re-fail a transaction that is already paid (mismatch check respects idempotency)", async () => {
    topLevelUpdateMany.mockResolvedValue({ count: 0 });

    await applyPaynowStatusUpdate(tx({ status: "paid", amount: 100 }), { status: "Paid", amount: "1.00" });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(topLevelUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tx-1", status: { not: "paid" } } }),
    );
  });
});
