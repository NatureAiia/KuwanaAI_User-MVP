import { prisma } from "@/lib/prisma";
import { normalizeStatus } from "@/lib/paynow";

/**
 * Applies a Paynow status update to a WalletTransaction, crediting the
 * matching balance field exactly once. Shared by the webhook (the source of
 * truth) and the /wallet/return page's poll fallback, since both can race to
 * report the same transaction as paid — the `tx.status !== "paid"` check
 * inside the transaction makes a duplicate call a no-op.
 */
export async function applyPaynowStatusUpdate(
  tx: { id: string; userId: string; currency: "USD" | "ZiG"; amount: unknown; status: string },
  fields: { status: string; paynowreference?: string },
) {
  const newStatus = normalizeStatus(fields.status);
  await prisma.$transaction(async (db) => {
    if (newStatus === "paid" && tx.status !== "paid") {
      const amount = tx.amount as import("@prisma/client").Prisma.Decimal;
      if (tx.currency === "USD") {
        await db.user.update({ where: { id: tx.userId }, data: { walletBalanceUsd: { increment: amount } } });
      } else {
        await db.user.update({ where: { id: tx.userId }, data: { walletBalanceZig: { increment: amount } } });
      }
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
