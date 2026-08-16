import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { ApiKeyForm } from "@/components/admin/ApiKeyForm";
import { ApiKeyRowActions } from "@/components/admin/ApiKeyRowActions";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminApiKeysPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [keys, providers] = await Promise.all([
    prisma.apiKey.findMany({ include: { provider: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.provider.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">API keys</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Read-only credentials for external BI tools — see /api/bi/v1/*. Never used by anything inside this app.
      </p>

      <div className="mt-6 max-w-[520px]">
        <ApiKeyForm providers={providers} />
      </div>

      <div className="mt-6">
        <SearchableSection placeholder="Search keys…">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-3 font-medium text-text-muted">Label</th>
                  <th className="p-3 font-medium text-text-muted">Scope</th>
                  <th className="p-3 font-medium text-text-muted">Provider</th>
                  <th className="p-3 font-medium text-text-muted">Last used</th>
                  <th className="p-3 font-medium text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} data-search-row className="border-b border-border last:border-0">
                    <td className="p-3 font-medium">{k.label}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} tone="sky">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-text-secondary">{k.provider?.name ?? "Platform-wide"}</td>
                    <td className="p-3 text-text-secondary">
                      {k.lastUsedAt ? k.lastUsedAt.toLocaleString() : "Never"}
                    </td>
                    <td className="p-3">
                      <ApiKeyRowActions id={k.id} revoked={!!k.revokedAt} />
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6">
                      <EmptyState
                        variant="inline"
                        title="No API keys yet."
                        description="Generate one using the form above to give an external BI tool read-only access."
                      />
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
