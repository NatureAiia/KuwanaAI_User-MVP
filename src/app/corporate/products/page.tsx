import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/lib/orgVerification";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { LinkButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { CorporatePortalNav } from "@/components/corporate/CorporatePortalNav";

export default async function CorporateProductsPage() {
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
      <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
        <Header />
        <CorporatePortalNav active="/corporate/products" />
        <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-6">
          <h1 className="font-display text-[20px] font-bold">Not linked yet</h1>
          <p className="mt-2 text-[13px] text-text-secondary">
            Your account has corporate access, but your company isn&apos;t linked to a product
            catalog yet. Ask an admin to link your email domain at /admin/catalog.
          </p>
        </div>
      </div>
    );
  }

  const listings = await prisma.listing.findMany({
    where: { providerId: provider.id },
    include: { category: { include: { sector: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-text-secondary">Corporate account</p>
          <h1 className="font-display text-[24px] font-bold">{provider.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/corporate/products/new" size="md">
            + Request new product
          </LinkButton>
          <LogoutButton />
        </div>
      </div>

      <CorporatePortalNav active="/corporate/products" />

      <div className="mt-6 grid gap-3">
        {listings.map((l) => (
          <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{l.name}</p>
              <p className="text-[11px] text-text-muted">
                {l.category.sector.name} / {l.category.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[14px]">
                {l.currency} {Number(l.price).toFixed(2)}
              </span>
              <Badge tone={l.status === "published" ? "teal" : l.status === "pending_review" ? "sky" : "neutral"}>
                {l.status.replace("_", " ")}
              </Badge>
              <Link
                href={`/corporate/products/${l.id}/edit`}
                className="tap-target text-[12.5px] font-semibold text-accent-sky hover:underline"
              >
                Request edit
              </Link>
            </div>
          </Card>
        ))}
        {listings.length === 0 && (
          <p className="text-[13px] text-text-muted">No products yet — request your first one above.</p>
        )}
      </div>
    </div>
  );
}
