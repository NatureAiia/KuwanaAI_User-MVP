import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/lib/orgVerification";
import { CorporateFieldRequestFormLazy } from "@/components/LazyClients";

export default async function NewCorporateFieldPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain ? await prisma.provider.findFirst({ where: { corporateDomain: domain } }) : null;
  if (!provider) redirect("/corporate/products");

  const categories = await prisma.category.findMany({
    where: { sector: { status: "live" } },
    include: { sector: { select: { name: true } } },
    orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
  });

  return <CorporateFieldRequestFormLazy categories={categories} />;
}
