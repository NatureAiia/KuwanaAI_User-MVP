import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProviderListingStats } from "@/lib/catalog";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { LinkButton } from "@/components/ui/Button";
import { ProviderStatsRow } from "@/components/provider/ProviderStatsRow";
import { ProviderFilterBar } from "@/components/provider/ProviderFilterBar";
import { ProviderListingsTable } from "@/components/provider/ProviderListingsTable";

const STATUSES = ["draft", "pending_review", "published", "rejected"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  draft: "Drafts",
  pending_review: "Needs review",
  published: "Published",
  rejected: "Rejected",
};

export default async function ProviderPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; categoryId?: string }>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "provider") redirect("/dashboard");

  const provider = await prisma.provider.findUnique({ where: { ownerUserId: user.id } });

  if (!provider) {
    return (
      <div className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
        <Header />
        <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-6">
          <h1 className="font-display text-[20px] font-bold">Not linked yet</h1>
          <p className="mt-2 text-[13px] text-text-secondary">
            Your account has provider access, but isn&apos;t linked to a provider record yet. Ask
            an admin to link your email at /admin/catalog.
          </p>
        </div>
      </div>
    );
  }

  const { status: statusFilter, q, categoryId } = await searchParams;
  const activeStatus = STATUSES.includes(statusFilter as Status) ? (statusFilter as Status) : undefined;

  const [allStatuses, categories, listings] = await Promise.all([
    prisma.listing.findMany({ where: { providerId: provider.id }, select: { status: true } }),
    prisma.category.findMany({
      where: { sector: { status: "live" } },
      include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.listing.findMany({
      where: {
        providerId: provider.id,
        ...(activeStatus ? { status: activeStatus } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { include: { sector: true } } },
      orderBy: { lastVerifiedAt: "desc" },
    }),
  ]);

  const stats = await getProviderListingStats(listings.map((l) => l.id));

  const counts: Record<Status, number> & { total: number } = {
    total: allStatuses.length,
    draft: allStatuses.filter((l) => l.status === "draft").length,
    pending_review: allStatuses.filter((l) => l.status === "pending_review").length,
    published: allStatuses.filter((l) => l.status === "published").length,
    rejected: allStatuses.filter((l) => l.status === "rejected").length,
  };
  const savedTotal = Object.values(stats).reduce((sum, s) => sum + s.savedCount, 0);
  const comparisonsTotal = Object.values(stats).reduce((sum, s) => sum + s.comparisonAppearances, 0);

  function statusHref(status?: Status) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (categoryId) params.set("categoryId", categoryId);
    const qs = params.toString();
    return qs ? `/provider?${qs}` : "/provider";
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-text-secondary">Provider account</p>
          <h1 className="font-display text-[24px] font-bold">{provider.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/provider/listings/new" size="md">
            + Add product
          </LinkButton>
          <LogoutButton />
        </div>
      </div>

      <ProviderStatsRow
        total={counts.total}
        draft={counts.draft}
        pendingReview={counts.pending_review}
        published={counts.published}
        rejected={counts.rejected}
        savedTotal={savedTotal}
        comparisonsTotal={comparisonsTotal}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={statusHref(undefined)}
          className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
            !activeStatus ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          All ({counts.total})
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={statusHref(s)}
            className={`tap-target rounded-full border px-4 py-2 text-[13px] font-medium ${
              activeStatus === s ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
            }`}
          >
            {STATUS_LABEL[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      <ProviderFilterBar
        categories={categories.map((c) => ({ id: c.id, name: c.name, sector: { name: c.sector.name } }))}
      />

      <ProviderListingsTable
        rows={listings.map((l) => ({
          id: l.id,
          name: l.name,
          images: l.images,
          price: Number(l.price),
          currency: l.currency,
          status: l.status,
          category: { name: l.category.name, sector: { name: l.category.sector.name } },
          savedCount: stats[l.id]?.savedCount ?? 0,
          comparisonAppearances: stats[l.id]?.comparisonAppearances ?? 0,
        }))}
      />
    </div>
  );
}
