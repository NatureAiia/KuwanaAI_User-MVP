import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { Card, Badge } from "@/components/ui/Card";
import { LogoutButton } from "@/components/LogoutButton";
import { NewProviderListingFormLazy } from "@/components/LazyClients";
import { ProviderListingActions } from "@/components/provider/ProviderListingActions";

const STATUS_TONE = {
  draft: "neutral",
  pending_review: "sky",
  published: "teal",
  rejected: "coral",
} as const;

export default async function ProviderPortalPage() {
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

  const [categories, listings] = await Promise.all([
    prisma.category.findMany({
      where: { sector: { status: "live" } },
      include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.listing.findMany({
      where: { providerId: provider.id },
      include: { category: { include: { sector: true } } },
      orderBy: { lastVerifiedAt: "desc" },
    }),
  ]);

  return (
    <div className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-text-secondary">Provider account</p>
          <h1 className="font-display text-[24px] font-bold">{provider.name}</h1>
        </div>
        <LogoutButton />
      </div>
      <p className="mt-2 text-[13px] text-text-secondary">
        Submit a listing here, then wait for admin review — nothing you submit goes live until
        it&apos;s approved.
      </p>

      <div className="mt-6 max-w-[420px]">
        <NewProviderListingFormLazy categories={categories} />
      </div>

      <section className="mt-8">
        <h2 className="font-display text-[16px] font-semibold">Your listings</h2>
        <div className="mt-3 flex flex-col gap-2">
          {listings.length === 0 && (
            <p className="text-[13px] text-text-muted">No listings yet — submit your first one above.</p>
          )}
          {listings.map((l) => (
            <Card key={l.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-[14px] font-semibold">{l.name}</p>
                  <p className="text-[11px] text-text-muted">
                    {l.category.sector.name} · {l.category.name} · {l.currency} {Number(l.price).toFixed(2)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[l.status]}>{l.status.replace("_", " ")}</Badge>
              </div>
              {l.status === "rejected" && l.rejectionReason && (
                <p className="text-[12px] text-accent-coral">Rejected: {l.rejectionReason}</p>
              )}
              {(l.status === "draft" || l.status === "pending_review" || l.status === "rejected") && (
                <ProviderListingActions
                  listingId={l.id}
                  status={l.status}
                  currentPrice={Number(l.price)}
                  currentCurrency={l.currency}
                />
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
