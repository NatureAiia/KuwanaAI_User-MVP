import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { corporateListingUpdateSchema } from "@/lib/corporateListingSchema";
import { validateListingAttributes } from "@/lib/attributeValidation";
import { recordPriceChange, logListingUpdate } from "@/lib/catalog";
import { revalidateCatalog } from "@/lib/cacheTags";

// A corporate account correcting its own listing's data (a scraper/admin
// error, a rate change, etc.) applies immediately — no admin-review hop,
// unlike a "new product" CorporateRequest. It's the business's own product;
// Kuwana just needs a record of who changed what, which logListingUpdate
// provides (see PROVENANCE_LABEL in listingDisplay.ts for how that's shown
// publicly).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing || existing.providerId !== auth.provider.id) {
    return privateJson({ error: "Listing not found" }, { status: 404 });
  }

  const parsed = corporateListingUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const { reason, attributes, ...rest } = parsed.data;
  const attrError = await validateListingAttributes(existing.categoryId, attributes);
  if (attrError) return privateJson({ error: attrError }, { status: 400 });

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      ...rest,
      ...(attributes ? { attributes: attributes as Prisma.InputJsonValue } : {}),
      lastVerifiedAt: new Date(),
      freshnessStatus: "fresh",
      lastUpdateSource: "corporate",
    },
  });

  if (rest.price !== undefined && Number(existing.price) !== rest.price) {
    await recordPriceChange(id, Number(existing.price));
  }

  await logListingUpdate({
    listingId: id,
    source: "corporate",
    actorLabel: auth.provider.name,
    changeSummary: reason,
  });

  revalidateCatalog();
  return privateJson({ listing });
}
