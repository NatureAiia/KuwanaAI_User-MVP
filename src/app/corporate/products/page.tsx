import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { LinkButton } from "@/components/ui/Button";
import { CorporateTag } from "@/components/corporate/CorporateTag";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { DividedList } from "@/components/corporate/DividedList";
import { PROVENANCE_LABEL } from "@/lib/listingDisplay";
import { formatDate } from "@/lib/format";

export default async function CorporateProductsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const listings = await prisma.listing.findMany({
    where: { providerId: provider.id },
    include: { category: { include: { sector: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[20px] font-bold">Products</h1>
        <LinkButton href="/corporate/products/new" size="md">
          + Request new product
        </LinkButton>
      </div>

      <DividedList
        className="mt-4"
        items={listings}
        keyFor={(l) => l.id}
        itemClassName="flex flex-wrap items-center justify-between gap-3"
        emptyMessage="No products yet — request your first one above."
        renderItem={(l) => (
          <>
            <div>
              <p className="text-[13.5px] font-medium">{l.name}</p>
              <p className="text-[11px] text-text-muted">
                {l.category.sector.name} / {l.category.name}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                Last updated by {l.lastUpdateSource === "corporate" ? "you" : PROVENANCE_LABEL[l.lastUpdateSource]},{" "}
                {formatDate(l.lastVerifiedAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[13.5px]">
                {l.currency} {Number(l.price).toFixed(2)}
              </span>
              <CorporateTag tone={l.status === "published" ? "teal" : l.status === "pending_review" ? "sky" : "neutral"}>
                {l.status.replace("_", " ")}
              </CorporateTag>
              <Link
                href={`/corporate/products/${l.id}/edit`}
                className="tap-target text-[12.5px] font-semibold text-accent-sky hover:underline"
              >
                Edit
              </Link>
            </div>
          </>
        )}
      />
    </div>
  );
}
