import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { CorporateRequestReview } from "@/components/admin/CorporateRequestReview";

export default async function AdminCorporateRequestsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const pendingRequests = await prisma.corporateRequest.findMany({
    where: { status: "pending" },
    include: {
      provider: { select: { name: true } },
      listing: { select: { id: true, name: true, price: true, currency: true } },
      category: { select: { name: true, sector: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Corporate requests</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Price/product changes submitted by corporate accounts (banks, telcos, insurers, etc. via
        /corporate/products) — nothing here reaches the catalog until it&apos;s approved below.
      </p>

      <section className="mt-6">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-[16px] font-semibold">Review queue</h2>
          {pendingRequests.length > 0 && <Badge tone="sky">{pendingRequests.length} pending</Badge>}
        </div>
        <div className="mt-3 space-y-3">
          {pendingRequests.map((r) => (
            <CorporateRequestReview
              key={r.id}
              request={{
                id: r.id,
                type: r.type,
                reason: r.reason,
                provider: r.provider,
                proposedData: r.proposedData as {
                  name: string;
                  description?: string | null;
                  price: number;
                  currency: string;
                },
                listing: r.listing,
                category: r.category,
              }}
            />
          ))}
          {pendingRequests.length === 0 && (
            <p className="text-[13px] text-text-muted">Nothing pending right now.</p>
          )}
        </div>
      </section>
    </div>
  );
}
