import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { resolveOwnProvider } from "@/lib/providerAuth";
import { Header } from "@/components/Header";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Card } from "@/components/ui/Card";
import { InviteTeammateForm } from "@/components/provider/InviteTeammateForm";
import { TeamMemberRow } from "@/components/provider/TeamMemberRow";

export default async function ProviderTeamPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "provider") redirect("/dashboard");

  const provider = await resolveOwnProvider(user.id);
  if (!provider) redirect("/provider");

  const [full, members] = await Promise.all([
    prisma.provider.findUnique({ where: { id: provider.id }, select: { owner: { select: { id: true, email: true } } } }),
    prisma.providerMember.findMany({
      where: { providerId: provider.id },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <Link
        href="/provider"
        className="tap-target -ml-2 mt-4 flex w-fit items-center gap-1 text-[13px] font-medium text-text-secondary"
      >
        <ArrowLeft size={16} /> Back to products
      </Link>

      <h1 className="mt-3 font-display text-[24px] font-bold">Team</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Everyone with access to {provider.name}&apos;s Kuwana account.
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        {full?.owner && <TeamMemberRow email={full.owner.email} role="Owner" />}
        {members.map((m) => (
          <TeamMemberRow
            key={m.userId}
            email={m.user.email}
            role="Teammate"
            userId={provider.isOwner ? m.userId : undefined}
          />
        ))}
      </div>

      {provider.isOwner ? (
        <Card className="mt-5">
          <p className="text-[13px] font-semibold">Invite a teammate</p>
          <p className="mt-1 text-[12px] text-text-secondary">
            They need their own Provider account already — ask them to sign up at /signup first, then invite
            them here by the email they used.
          </p>
          <InviteTeammateForm />
        </Card>
      ) : (
        <p className="mt-5 text-[12px] text-text-muted">
          Only {full?.owner?.email ?? "the account that created this business"} can invite or remove teammates.
        </p>
      )}

      <BottomTabBar />
    </div>
  );
}
