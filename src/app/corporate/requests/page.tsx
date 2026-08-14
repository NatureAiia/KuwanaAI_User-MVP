import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/lib/orgVerification";
import { Card } from "@/components/ui/Card";
import { CorporateTag } from "@/components/corporate/CorporateTag";

const STATUS_TONE = {
  pending: "sky",
  approved: "teal",
  rejected: "coral",
} as const;

export default async function CorporateRequestsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain
    ? await prisma.provider.findFirst({ where: { corporateDomain: domain } })
    : null;

  if (!provider) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-6">
        <h1 className="font-display text-[18px] font-bold">Not linked yet</h1>
        <p className="mt-2 text-[13px] text-text-secondary">
          Your account has corporate access, but your company isn&apos;t linked to a product
          catalog yet. Ask an admin to link your email domain at /admin/catalog.
        </p>
      </div>
    );
  }

  const requests = await prisma.corporateRequest.findMany({
    where: { providerId: provider.id },
    include: { listing: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Requests</h1>

      <div className="mt-4 grid gap-2.5">
        {requests.map((r) => {
          const proposed = r.proposedData as { name: string };
          return (
            <Card key={r.id} className="!p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-medium">
                  {r.type === "edit" ? `Edit "${r.listing?.name ?? proposed.name}"` : `New product "${proposed.name}"`}
                </p>
                <CorporateTag tone={STATUS_TONE[r.status]}>{r.status}</CorporateTag>
              </div>
              <p className="mt-1.5 text-[12.5px] text-text-secondary">{r.reason}</p>
              {r.status === "rejected" && r.rejectionReason && (
                <p className="mt-1.5 text-[12.5px] text-accent-coral">Reviewer note: {r.rejectionReason}</p>
              )}
              <p className="mt-2 text-[11px] text-text-muted">
                Submitted {r.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                {r.reviewedAt && ` · Reviewed ${r.reviewedAt.toISOString().replace("T", " ").slice(0, 19)}`}
              </p>
            </Card>
          );
        })}
        {requests.length === 0 && (
          <p className="text-[13px] text-text-muted">No requests yet.</p>
        )}
      </div>
    </div>
  );
}
