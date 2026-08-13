import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailDomain } from "@/lib/orgVerification";
import { Header } from "@/components/Header";
import { CorporateProductRequestFormLazy } from "@/components/LazyClients";

export default async function NewCorporateProductPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "corporate") redirect("/dashboard");

  const domain = user.email ? emailDomain(user.email) : null;
  const provider = domain
    ? await prisma.provider.findFirst({ where: { corporateDomain: domain } })
    : null;
  if (!provider) redirect("/corporate/products");

  const categories = await prisma.category.findMany({
    where: { sector: { status: "live" } },
    include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-6">
        <CorporateProductRequestFormLazy mode="new_listing" categories={categories} />
      </div>
    </div>
  );
}
