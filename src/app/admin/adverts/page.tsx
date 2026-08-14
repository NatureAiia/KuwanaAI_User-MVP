import { notFound } from "next/navigation";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Card";
import { AdvertForm } from "@/components/admin/AdvertForm";
import { AdvertRowActions } from "@/components/admin/AdvertRowActions";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function AdminAdvertsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const adverts = await prisma.advert.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Adverts</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {adverts.length} advert(s). Active ones rotate through the explore page&apos;s ad slot, one minute each.
      </p>

      <div className="mt-6">
        <AdvertForm />
      </div>

      <div className="mt-6">
      <SearchableSection placeholder="Search adverts…">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised text-left">
              <th className="p-3 font-medium text-text-muted">Image</th>
              <th className="p-3 font-medium text-text-muted">Sponsor</th>
              <th className="p-3 font-medium text-text-muted">Tagline</th>
              <th className="p-3 font-medium text-text-muted">Status</th>
              <th className="p-3 font-medium text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adverts.map((a) => (
              <tr key={a.id} data-search-row className="border-b border-border last:border-0">
                <td className="p-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-border">
                    <Image src={a.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                </td>
                <td className="p-3 font-medium">{a.sponsorName}</td>
                <td className="p-3 text-text-secondary">{a.tagline}</td>
                <td className="p-3">
                  <Badge tone={a.active ? "teal" : "neutral"}>{a.active ? "Active" : "Paused"}</Badge>
                </td>
                <td className="p-3">
                  <AdvertRowActions advertId={a.id} active={a.active} />
                </td>
              </tr>
            ))}
            {adverts.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-text-muted">
                  No adverts yet.
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
