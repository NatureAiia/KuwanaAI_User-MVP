import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { NewListingFormLazy, NewProviderFormLazy } from "@/components/LazyClients";
import { ListingRowActions } from "@/components/admin/ListingRowActions";
import { ProviderOwnerLink } from "@/components/admin/ProviderOwnerLink";
import { ProviderWebsiteLink } from "@/components/admin/ProviderWebsiteLink";
import { CorporateDomainLink } from "@/components/admin/CorporateDomainLink";
import { SearchableSection } from "@/components/admin/SearchableSection";
import { FRESHNESS_TONE } from "@/lib/listingDisplay";
import { EmptyState } from "@/components/ui/EmptyState";

const STATUS_TONE = {
  draft: "neutral",
  pending_review: "sky",
  published: "teal",
  rejected: "coral",
} as const;

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { status: statusFilter } = await searchParams;
  const activeStatus =
    statusFilter && ["draft", "pending_review", "published", "rejected"].includes(statusFilter)
      ? (statusFilter as keyof typeof STATUS_TONE)
      : undefined;

  const [listings, pendingCount, categories, providers] = await Promise.all([
    prisma.listing.findMany({
      where: activeStatus ? { status: activeStatus } : undefined,
      include: { provider: true, category: { include: { sector: true } } },
      orderBy: [{ category: { sector: { name: "asc" } } }, { name: "asc" }],
      take: 500,
    }),
    prisma.listing.count({ where: { status: "pending_review" } }),
    prisma.category.findMany({
      include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.provider.findMany({ orderBy: { name: "asc" }, include: { owner: { select: { email: true } } } }),
  ]);

  const listingsEmptyTitle = activeStatus
    ? `No ${activeStatus.replace("_", " ")} listings.`
    : "No listings yet.";
  const listingsEmptyDescription = activeStatus
    ? "Try a different filter, or check back after providers submit more listings."
    : "Add one using the form above, or wait for a provider to submit one.";

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Catalog</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {listings.length} listing(s) across {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
        {providers.length} provider(s). Editing a listing marks it freshly verified.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/admin/catalog"
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeStatus ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/catalog?status=pending_review"
          className={`tap-target flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium ${
            activeStatus === "pending_review"
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border text-text-secondary"
          }`}
        >
          Needs review
          {pendingCount > 0 && <Badge tone="coral">{pendingCount}</Badge>}
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <NewListingFormLazy categories={categories} providers={providers} />
        <NewProviderFormLazy />
      </div>

      <div className="mt-8">
      <SearchableSection placeholder="Search listings…">
      <div className="max-h-[70vh] overflow-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="sticky top-0 z-[1] border-b border-border bg-bg-surface-raised text-left">
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
              <tr key={l.id} data-search-row className="border-b border-border last:border-0">
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
                    currentDescription={l.description}
                    currentImages={l.images}
                    status={l.status}
                  />
                </td>
              </tr>
            ))}
            {listings.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6">
                  <EmptyState
                    variant="inline"
                    title={listingsEmptyTitle}
                    description={listingsEmptyDescription}
                    action={activeStatus ? { label: "Clear filter", href: "/admin/catalog" } : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </SearchableSection>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-[16px] font-semibold">Providers</h2>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Link a provider to a user&apos;s email to let that account manage it via /provider —
          the only way a &quot;provider&quot; role account can self-submit listings. Link a
          corporate domain to let every &quot;corporate&quot; role account on that domain (e.g.
          every @cbz.co.zw address) submit edit/new-product requests via /corporate/products.
        </p>
        <div className="mt-3">
        <SearchableSection placeholder="Search providers…">
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
          <table className="w-full min-w-[680px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-bg-surface-raised text-left">
                <th className="p-3 font-medium text-text-muted">Provider</th>
                <th className="p-3 font-medium text-text-muted">Verified</th>
                <th className="p-3 font-medium text-text-muted">Website</th>
                <th className="p-3 font-medium text-text-muted">Owner</th>
                <th className="p-3 font-medium text-text-muted">Corporate domain</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr key={p.id} data-search-row className="border-b border-border last:border-0">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3">
                    <Badge tone={p.verified ? "teal" : "coral"}>{p.verified ? "Verified" : "Unverified"}</Badge>
                  </td>
                  <td className="p-3">
                    <ProviderWebsiteLink providerId={p.id} currentWebsiteUrl={p.websiteUrl} />
                  </td>
                  <td className="p-3">
                    <ProviderOwnerLink providerId={p.id} currentOwnerEmail={p.owner?.email ?? null} />
                  </td>
                  <td className="p-3">
                    <CorporateDomainLink providerId={p.id} currentDomain={p.corporateDomain} />
                  </td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6">
                    <EmptyState
                      variant="inline"
                      title="No providers yet."
                      description="Add one using the form above to onboard a provider."
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
    </div>
  );
}
