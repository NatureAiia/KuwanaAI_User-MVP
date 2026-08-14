import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

export async function GET() {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const [transactions, dbUser] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { walletBalanceUsd: true, walletBalanceZig: true },
    }),
  ]);

  return privateJson({
    transactions,
    balances: {
      usd: dbUser?.walletBalanceUsd.toString() ?? "0.00",
      zig: dbUser?.walletBalanceZig.toString() ?? "0.00",
    },
  });
}
