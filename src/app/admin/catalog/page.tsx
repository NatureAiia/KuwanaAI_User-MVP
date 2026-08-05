import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { NewListingForm } from "@/components/admin/NewListingForm";
import { NewProviderForm } from "@/components/admin/NewProviderForm";
import { ListingRowActions } from "@/components/admin/ListingRowActions";
import { ProviderOwnerLink } from "@/components/admin/ProviderOwnerLink";
import { FRESHNESS_TONE } from "@/lib/listingDisplay";

const STATUS_TONE = {
  draft: "neutral",
  pending_review: "sky",
  published: "teal",
  rejected: "coral",
} as const;

export default async function AdminCatalogPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const [listings, categories, providers] = await Promise.all([
    prisma.listing.findMany({
      include: { provider: true, category: { include: { sector: true } } },
      orderBy: [{ category: { sector: { name: "asc" } } }, { name: "asc" }],
      take: 500,
    }),
    prisma.category.findMany({
      include: { sector: true },
      orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.provider.findMany({ orderBy: { name: "asc" }, include: { owner: { select: { email: true } } } }),
  ]);

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Catalog</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {listings.length} listing(s) across {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
        {providers.length} provider(s). Editing a listing marks it freshly verified.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <NewListingForm categories={categories} providers={providers} />
        <NewProviderForm />
      </div>

      <div className="mt-8 overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised text-left">
              <th className="p-3 font-medium text-text-muted">Sector / Category</th>
              <th className="p-3 font-medium text-text-muted">Listing</th>
              <th className="p-3 font-medium text-text-muted">Provider</th>
              <th className="p-3 font-medium text-text-muted">Price</th>
              <th className="p-3 font-medium text-text-muted">Freshness</th>
              <th className="p-3 font-medium text-text-muted">Status</th>
              <th className="p-3 font-medium text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="p-3 text-text-secondary">
                  {l.category.sector.name}
                  <span className="text-text-muted"> / {l.category.name}</span>
                </td>
                <td className="p-3 font-medium">{l.name}</td>
                <td className="p-3">
                  {l.provider.name}
                  {!l.provider.verified && <Badge tone="coral" className="ml-1.5">Unverified</Badge>}
                </td>
                <td className="p-3 font-mono">
                  {l.currency} {Number(l.price).toFixed(2)}
                </td>
                <td className="p-3">
                  <Badge tone={FRESHNESS_TONE[l.freshnessStatus as keyof typeof FRESHNESS_TONE]}>
                    {l.freshnessStatus}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge tone={STATUS_TONE[l.status]}>{l.status.replace("_", " ")}</Badge>
                </td>
                <td className="p-3">
                  <ListingRowActions
                    listingId={l.id}
                    currentPrice={Number(l.price)}
                    currentCurrency={l.currency}
                    currentSourceUrl={l.sourceUrl}
                  />
                </td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-text-muted">
                  No listings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-[16px] font-semibold">Providers</h2>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Link a provider to a user&apos;s email to let that account manage it via /provider —
          the only way a &quot;provider&quot; role account can self-submit listings.
        </p>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-bg-surface-raised text-left">
                <th className="p-3 font-medium text-text-muted">Provider</th>
                <th className="p-3 font-medium text-text-muted">Verified</th>
                <th className="p-3 font-medium text-text-muted">Owner</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">
                    <Badge tone={p.verified ? "teal" : "coral"}>{p.verified ? "Verified" : "Unverified"}</Badge>
                  </td>
                  <td className="p-3">
                    <ProviderOwnerLink providerId={p.id} currentOwnerEmail={p.owner?.email ?? null} />
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-text-muted">
                    No providers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
