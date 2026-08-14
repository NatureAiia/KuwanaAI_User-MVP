import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/lib/orgVerification";
import { CorporateHeader } from "@/components/corporate/CorporateHeader";
import { CorporatePortalNav } from "@/components/corporate/CorporatePortalNav";

// Auth gate + chrome only — the same "layout re-checks for the gate, page
// re-checks for its own data" split src/app/admin/layout.tsx already uses.
// Every corporate page keeps its own requireUser()/role/provider lookup for
// its own data; this just means no page has to hand-render <Header /> +
// <CorporatePortalNav /> anymore.
export default async function CorporateLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, profile: { select: { fullName: true } } },
  });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain
    ? await prisma.provider.findFirst({ where: { corporateDomain: domain }, select: { name: true } })
    : null;
  // Falls back to the free-text organization name captured at signup
  // (UserProfile.fullName) until an admin links the domain to a Provider.
  const companyName = provider?.name ?? dbUser.profile?.fullName ?? "Corporate";

  return (
    <div id="main-content" tabIndex={-1} className="flex min-h-screen flex-1 flex-col">
      <CorporateHeader companyName={companyName} />
      <div className="flex flex-1 flex-col md:flex-row">
        <CorporatePortalNav companyName={companyName} />
        <main className="flex-1 bg-bg-base px-5 pb-12 pt-4 md:px-8 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
