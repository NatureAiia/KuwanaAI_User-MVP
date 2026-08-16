import { FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { BulkPriceUpdateForm } from "@/components/corporate/BulkPriceUpdateForm";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function CorporateDataImportPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const listings = await prisma.listing.findMany({
    where: { providerId: provider.id, status: "published" },
    select: { id: true, name: true },
  });
  const listingsById = Object.fromEntries(listings.map((l) => [l.id, l.name]));

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Data import</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Bulk-update prices across your own listings from a CSV file, instead of editing them one at a time.
      </p>

      <div className="mt-6">
        <BulkPriceUpdateForm listingsById={listingsById} />
      </div>

      {listings.length === 0 && (
        <EmptyState
          className="mt-4"
          icon={FileSpreadsheet}
          title="Nothing to bulk-update yet"
          description="This tool updates prices on listings that are already published. Request your first product, then come back here once it's live."
          action={{ label: "Request a new product", href: "/corporate/products/new" }}
        />
      )}
    </div>
  );
}
