import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
  return NextResponse.json({ listings });
}

export async function POST(req: Request) {
  const auth = await requireOwnProvider();
  if ("response" in auth) return auth.response;

  const parsed = providerCreateListingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

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

  return NextResponse.json({ listing });
}
