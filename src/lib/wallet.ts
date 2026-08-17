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
export async function applyPaynowStatusUpdate(
  tx: { id: string; userId: string; currency: "USD" | "ZiG"; amount: unknown; status: string },
  fields: { status: string; paynowreference?: string },
) {
  const newStatus = normalizeStatus(fields.status);
  const amount = tx.amount as import("@prisma/client").Prisma.Decimal;
  const balanceField = tx.currency === "USD" ? "walletBalanceUsd" : "walletBalanceZig";

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
