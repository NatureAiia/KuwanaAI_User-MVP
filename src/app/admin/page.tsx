import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Card } from "@/components/ui/Card";

const ADMIN_LINKS = [
  { href: "/admin/catalog", label: "Catalog", blurb: "Providers and listings across every sector — create, edit, retire." },
  { href: "/admin/social-mentions", label: "Social price mentions", blurb: "Review free-scanner posts that mention a price." },
];

export default async function AdminHubPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  return (
    <div className="mx-auto max-w-[720px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Admin</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Signed in as {admin.email}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ADMIN_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:border-accent-sky/50">
              <p className="font-display text-[15px] font-semibold">{link.label}</p>
              <p className="mt-1 text-[12.5px] text-text-secondary">{link.blurb}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
