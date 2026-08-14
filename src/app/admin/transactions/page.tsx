import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/Card";
import { SearchableSection } from "@/components/admin/SearchableSection";

const STATUS_TONE: Record<string, "neutral" | "sky" | "teal" | "coral"> = {
  initiated: "sky",
  pending: "sky",
  paid: "teal",
  cancelled: "coral",
  failed: "coral",
  refunded: "neutral",
};

export default async function AdminTransactionsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const transactions = await prisma.walletTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Transactions</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Every Paynow wallet top-up attempt, most recent first.
      </p>

      <div className="mt-6">
        <SearchableSection placeholder="Search transactions…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">User</th>
                  <th className="p-3 font-medium text-text-muted">Reference</th>
                  <th className="p-3 font-medium text-text-muted">Amount</th>
                  <th className="p-3 font-medium text-text-muted">Status</th>
                  <th className="p-3 font-medium text-text-muted">Paynow ref</th>
                  <th className="p-3 font-medium text-text-muted">Created</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{tx.user.email}</td>
                    <td className="p-3 text-text-secondary">{tx.reference}</td>
                    <td className="p-3 text-text-secondary">
                      {tx.currency} {tx.amount.toString()}
                    </td>
                    <td className="p-3">
                      <Badge tone={STATUS_TONE[tx.status] ?? "neutral"}>{tx.status}</Badge>
                    </td>
                    <td className="p-3 text-text-secondary">{tx.paynowReference ?? "—"}</td>
                    <td className="p-3 text-text-secondary">
                      {tx.createdAt.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text-muted">
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SearchableSection>
      </div>
    </div>
  );
}
