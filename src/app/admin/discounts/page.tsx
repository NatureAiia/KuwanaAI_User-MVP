import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { DiscountRuleForm } from "@/components/admin/DiscountRuleForm";
import { DiscountRuleRowActions } from "@/components/admin/DiscountRuleRowActions";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function AdminDiscountsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const now = new Date();
  const [discountRules, providers, categories, listings] = await Promise.all([
    prisma.discountRule.findMany({
      include: { provider: true, category: { include: { sector: true } }, listing: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.provider.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ include: { sector: true }, orderBy: { name: "asc" } }),
    prisma.listing.findMany({
      where: { status: "published" },
      select: { id: true, name: true, providerId: true, categoryId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Discounts</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {discountRules.length} discount rule(s), scoped to a category or a single listing. A discount only changes
        the price shown alongside a listing — it never feeds into the pricing-intelligence peer stats or z-scores.
      </p>

      <div className="mt-6">
        <DiscountRuleForm providers={providers} categories={categories} listings={listings} />
      </div>

      <div className="mt-6">
        <SearchableSection placeholder="Search discount rules…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">Provider</th>
                  <th className="p-3 font-medium text-text-muted">Scope</th>
                  <th className="p-3 font-medium text-text-muted">% off</th>
                  <th className="p-3 font-medium text-text-muted">Window</th>
                  <th className="p-3 font-medium text-text-muted">Status</th>
                  <th className="p-3 font-medium text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {discountRules.map((rule) => {
                  const active = rule.startsAt <= now && rule.endsAt >= now;
                  return (
                    <tr key={rule.id} data-search-row className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{rule.provider.name}</td>
                      <td className="p-3 text-text-secondary">
                        {rule.scope === "category"
                          ? `Category: ${rule.category ? `${rule.category.sector.name} / ${rule.category.name}` : "—"}`
                          : `Listing: ${rule.listing?.name ?? "—"}`}
                      </td>
                      <td className="p-3 font-mono">{Number(rule.percentOff)}%</td>
                      <td className="p-3 text-text-secondary">
                        {rule.startsAt.toLocaleDateString("en-ZA", { dateStyle: "medium" })} –{" "}
                        {rule.endsAt.toLocaleDateString("en-ZA", { dateStyle: "medium" })}
                      </td>
                      <td className="p-3">
                        <Badge tone={active ? "teal" : "neutral"}>{active ? "Active" : rule.endsAt < now ? "Expired" : "Scheduled"}</Badge>
                      </td>
                      <td className="p-3">
                        <DiscountRuleRowActions discountRuleId={rule.id} />
                      </td>
                    </tr>
                  );
                })}
                {discountRules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text-muted">
                      No discount rules yet.
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
