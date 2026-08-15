import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireOwnCorporateOrg } from "@/lib/corporateAuth";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  const auth = await requireOwnCorporateOrg();
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  // Confirm the listing actually belongs to this provider before creating a
  // record against it — the same ownership check requireOwnCorporateOrg
  // can't do on its own since it only knows the provider, not the listing.
  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    select: { providerId: true, name: true },
  });
  if (!listing || listing.providerId !== auth.provider.id) {
    return privateJson({ error: "Listing not found" }, { status: 404 });
  }

  const investigation = await prisma.listingInvestigation.create({
    data: {
      listingId: parsed.data.listingId,
      listingName: listing.name,
      providerId: auth.provider.id,
      reason: parsed.data.reason,
    },
  });

  return privateJson({ investigation });
}
