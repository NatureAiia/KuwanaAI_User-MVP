import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveOwnProvider } from "@/lib/providerAuth";
import { Header } from "@/components/Header";
import { ProviderListingFormLazy } from "@/components/LazyClients";

export default async function NewProviderListingPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "provider") redirect("/dashboard");

  const provider = await resolveOwnProvider(user.id);
  if (!provider) redirect("/provider");

  const categories = await prisma.category.findMany({
    where: { sector: { status: "live" } },
    include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-6">
        <ProviderListingFormLazy mode="create" categories={categories} />
      </div>
    </div>
  );
}
