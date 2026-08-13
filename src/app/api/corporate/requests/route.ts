import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";
import { createCorporateRequestSchema } from "@/lib/corporateRequestSchema";

export async function POST(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const parsed = createCorporateRequestSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;

  if (data.type === "edit") {
    const listing = await prisma.listing.findUnique({ where: { id: data.listingId }, select: { providerId: true } });
    if (!listing || listing.providerId !== auth.provider.id) {
      return privateJson({ error: "Listing not found" }, { status: 404 });
    }
  }

  const request = await prisma.corporateRequest.create({
    data: {
      providerId: auth.provider.id,
      submittedByUserId: auth.user.id,
      type: data.type,
      listingId: data.type === "edit" ? data.listingId : undefined,
      categoryId: data.type === "new_listing" ? data.categoryId : undefined,
      proposedData: data.proposedData as Prisma.InputJsonValue,
      reason: data.reason,
    },
  });

  return privateJson({ request });
}
