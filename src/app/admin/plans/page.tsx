import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAllSubscriptions } from "@/lib/subscriptions";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { Badge } from "@/components/ui/Card";

function formatPrice(priceCents: number, currency: string) {
  return `${currency} ${(priceCents / 100).toFixed(2)}`;
}

function formatBillingPeriod(months: number) {
  return months === 1 ? "Monthly" : `Every ${months} months`;
}

export default async function AdminPlansPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  // Runs on every load (not just the daily cron) so the page is always
  // complete/accurate — same "compute on read" shape as the notification sync.
  await ensureAllSubscriptions();

  const [plans, subscriptions] = await Promise.all([
    prisma.plan.findMany({ orderBy: { role: "asc" } }),
    prisma.subscription.findMany({
      include: { user: { select: { email: true, role: true } }, plan: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Plans</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Every account&apos;s features are granted automatically from its plan, billed monthly through Paynow.
        Pricing isn&apos;t finalized yet — every plan is $0, so every account currently has full access
        regardless of plan.
      </p>

      <h2 className="mt-8 text-[15px] font-semibold">Plan catalog</h2>
      <div className="mt-3 overflow-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised text-left">
              <th className="p-3 font-medium text-text-muted">Portal</th>
              <th className="p-3 font-medium text-text-muted">Plan</th>
              <th className="p-3 font-medium text-text-muted">Price</th>
              <th className="p-3 font-medium text-text-muted">Billing period</th>
              <th className="p-3 font-medium text-text-muted">Features</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium capitalize">{p.role}</td>
                <td className="p-3">{p.name}</td>
                <td className="p-3 text-text-secondary">{formatPrice(p.priceCents, p.currency)}</td>
                <td className="p-3 text-text-secondary">{formatBillingPeriod(p.billingPeriodMonths)}</td>
                <td className="p-3 text-text-secondary">
                  {p.features.length === 0 ? <Badge tone="teal">All features</Badge> : p.features.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-[15px] font-semibold">Subscriptions</h2>
      <div className="mt-3">
        <SearchableSection placeholder="Search subscriptions…">
          <div className="max-h-[70vh] overflow-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">User</th>
                  <th className="p-3 font-medium text-text-muted">Role</th>
                  <th className="p-3 font-medium text-text-muted">Plan</th>
                  <th className="p-3 font-medium text-text-muted">Price</th>
                  <th className="p-3 font-medium text-text-muted">Renews</th>
                  <th className="p-3 font-medium text-text-muted">Auto-renew</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{s.user.email}</td>
                    <td className="p-3 text-text-secondary capitalize">{s.user.role}</td>
                    <td className="p-3 text-text-secondary">{s.plan.name}</td>
                    <td className="p-3 text-text-secondary">{formatPrice(s.plan.priceCents, s.plan.currency)}</td>
                    <td className="p-3 text-text-secondary">{s.currentPeriodEnd.toLocaleDateString()}</td>
                    <td className="p-3">
                      <Badge tone={s.autoRenew ? "teal" : "neutral"}>{s.autoRenew ? "On" : "Off"}</Badge>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text-muted">
                      No subscriptions yet.
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
