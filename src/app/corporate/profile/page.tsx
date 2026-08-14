import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/lib/orgVerification";
import { CompanyProfileForm } from "@/components/corporate/CompanyProfileForm";

export default async function CorporateProfilePage() {
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

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Company Profile</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        This is your company&apos;s own profile — not a personal account profile. It&apos;s what
        shoppers see on every one of your listings.
      </p>
      <div className="mt-4">
        <CompanyProfileForm
          initialName={provider.name}
          initialLogoUrl={provider.logoUrl}
          initialDescription={provider.description}
        />
      </div>
    </div>
  );
}
