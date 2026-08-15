import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RegulatorHeader } from "@/components/regulator/RegulatorHeader";
import { RegulatorPortalNav } from "@/components/regulator/RegulatorPortalNav";

// Auth gate + chrome only — same "layout re-checks for the gate, page
// re-checks for its own data" split corporate/admin layouts already use.
// Every regulator page keeps its own requireRegulatorUser() call for its own
// data; this just means no page has to hand-render header + nav anymore.
export default async function RegulatorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, profile: { select: { fullName: true } } },
  });
  if (dbUser?.role !== "regulator") redirect("/dashboard");

  // UserProfile.fullName holds the regulator body's name (e.g. "POTRAZ") for
  // this role — set once at onboarding from onboardingSchema's regulatorName
  // field (see src/app/api/onboarding/route.ts).
  const regulatorName = dbUser.profile?.fullName ?? "Regulator";

  return (
    <div id="main-content" tabIndex={-1} className="flex min-h-screen flex-1 flex-col">
      <RegulatorHeader regulatorName={regulatorName} />
      <div className="flex flex-1 flex-col md:flex-row">
        <RegulatorPortalNav />
        {/* pb-24 clears the fixed PortalMobileNav bar on mobile (see RegulatorPortalNav); md drops back to pb-12 since that nav is desktop-sidebar-only above md. */}
        <main className="flex-1 bg-bg-base px-5 pb-24 pt-4 md:px-8 md:pb-12 md:pt-6">{children}</main>
      </div>
    </div>
  );
}
