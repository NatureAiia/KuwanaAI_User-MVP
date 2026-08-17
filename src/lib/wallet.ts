import { prisma } from "@/lib/prisma";
import { normalizeStatus } from "@/lib/paynow";

/**
 * Applies a Paynow status update to a WalletTransaction, crediting or
 * reversing the matching balance field exactly once. Shared by the webhook
 * (the source of truth) and the /wallet/return page's poll fallback, since
 * both can race to report the same transaction — the guard lives in the
 * `updateMany` `where` clause (matched against the DB row's live status,
 * not the caller's possibly-stale `tx.status`), so a duplicate/concurrent
 * call is a no-op regardless of which one wins the race.
 */
/**
 * Paynow reports money as a decimal string. Compared at cent precision rather
 * than as floats — `10.10 !== 10.1` is a string problem and `0.1 + 0.2` is a
 * float one, and neither should be able to reject a correct settlement.
 */
function centsMatch(reported: string, expected: unknown): boolean {
  const a = Math.round(Number(reported) * 100);
  const b = Math.round(Number(expected) * 100);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}

export async function applyPaynowStatusUpdate(
  tx: { id: string; userId: string; currency: "USD" | "ZiG"; amount: unknown; status: string },
  fields: { status: string; paynowreference?: string; amount?: string },
) {
  const newStatus = normalizeStatus(fields.status);
  const amount = tx.amount as import("@prisma/client").Prisma.Decimal;
  const balanceField = tx.currency === "USD" ? "walletBalanceUsd" : "walletBalanceZig";

  // A verified hash proves Paynow sent the callback; it does not prove the
  // customer paid what we asked for. Crediting `tx.amount` — the amount we
  // *requested* — means a settlement of $1 against a $100 top-up credits $100.
  //
  // Only enforced when the payload carries an amount at all: the poll fallback
  // (pollTransactionStatus) genuinely has no amount field, and failing closed
  // there would break the path that exists for when the webhook never lands.
  if (newStatus === "paid" && fields.amount !== undefined && !centsMatch(fields.amount, amount)) {
    await prisma.walletTransaction.updateMany({
      where: { id: tx.id, status: { not: "paid" } },
      data: {
        status: "failed",
        paynowStatus: fields.status,
        paynowReference: fields.paynowreference,
        failureReason: `Amount mismatch: Paynow reported ${fields.amount}, expected ${String(amount)}`,
      },
    });
    // Deliberately neither amount is credited. Crediting the smaller one would
    // silently convert a short payment into a discount; the row is left for an
    // admin to resolve against Paynow's own record.
    console.error(`[paynow] amount mismatch on transaction ${tx.id} — not credited`);
    return "failed" as const;
  }

  await prisma.$transaction(async (db) => {
    if (newStatus === "paid") {
      const { count } = await db.walletTransaction.updateMany({
        where: { id: tx.id, status: { not: "paid" } },
        data: { status: newStatus, paynowStatus: fields.status, paynowReference: fields.paynowreference },
      });
      if (count === 1) {
        await db.user.update({ where: { id: tx.userId }, data: { [balanceField]: { increment: amount } } });
      }
      return;
    }

    if (newStatus === "refunded") {
      const { count } = await db.walletTransaction.updateMany({
        where: { id: tx.id, status: "paid" },
        data: { status: newStatus, paynowStatus: fields.status, paynowReference: fields.paynowreference },
      });
      if (count === 1) {
        await db.user.update({ where: { id: tx.userId }, data: { [balanceField]: { decrement: amount } } });
      }
      return;
    }

    await db.walletTransaction.update({
      where: { id: tx.id },
      data: {
        status: newStatus,
        paynowStatus: fields.status,
        paynowReference: fields.paynowreference,
      },
    });
  });
  return newStatus;
}
