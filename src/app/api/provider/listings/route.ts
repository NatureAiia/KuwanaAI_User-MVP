import { privateJson } from "@/lib/apiResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireOwnProvider } from "@/lib/providerAuth";
import { providerCreateListingSchema } from "@/lib/providerListingSchema";

export async function GET() {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const listings = await prisma.listing.findMany({
    where: { providerId: auth.provider.id },
    include: { category: { include: { sector: true } } },
    orderBy: { lastVerifiedAt: "desc" },
  });
  return privateJson({ listings });
}

export async function POST(req: Request) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const parsed = providerCreateListingSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const { status, ...rest } = parsed.data;
  const listing = await prisma.listing.create({
    data: {
      ...rest,
      attributes: rest.attributes as Prisma.InputJsonValue,
      providerId: auth.provider.id,
      status,
      freshnessStatus: "unverified", // not yet checked by anyone but the submitting provider
    },
  });

  // The catalog read cache is keyed by tag, not by TTL alone — without
  // this, an edited price keeps serving stale until the 5-minute backstop.
  revalidateCatalog();
  return privateJson({ listing });
}
