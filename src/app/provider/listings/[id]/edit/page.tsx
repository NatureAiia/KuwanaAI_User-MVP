import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { ProviderListingForm } from "@/components/provider/ProviderListingForm";

export default async function EditProviderListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (dbUser?.role !== "provider") redirect("/dashboard");

  const provider = await prisma.provider.findUnique({ where: { ownerUserId: user.id } });
  if (!provider) redirect("/provider");

  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.providerId !== provider.id) notFound();

  const categories = await prisma.category.findMany({
    where: { sector: { status: "live" } },
    include: { sector: true, attributeSchema: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sector: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-12 pt-6 md:px-10">
      <Header />
      <div className="mt-6">
        <ProviderListingForm
          mode="edit"
          categories={categories}
          listing={{
            id: listing.id,
            categoryId: listing.categoryId,
            name: listing.name,
            description: listing.description,
            attributes: listing.attributes as Record<string, unknown>,
            price: Number(listing.price),
            currency: listing.currency,
            images: listing.images,
            status: listing.status,
            rejectionReason: listing.rejectionReason,
          }}
        />
      </div>
    </div>
  );
}
