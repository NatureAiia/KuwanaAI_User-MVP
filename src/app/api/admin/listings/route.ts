import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/**
 * Admin content API — an alternative to hand-editing prisma/seed.ts for
 * every content change. Deliberately no UI yet, just an authenticated
 * surface; a real admin panel can be built against this later.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const categoryId = new URL(req.url).searchParams.get("categoryId");

  const listings = await prisma.listing.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { provider: true, category: { include: { sector: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return NextResponse.json({ listings });
}

const createSchema = z.object({
  categoryId: z.string(),
  providerId: z.string(),
  name: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()),
  price: z.number().positive(),
  currency: z.string().default("USD"),
  sourceUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const listing = await prisma.listing.create({
    data: {
      ...parsed.data,
      attributes: parsed.data.attributes as Prisma.InputJsonValue,
      freshnessStatus: "fresh",
      lastVerifiedAt: new Date(),
    },
  });

  return NextResponse.json({ listing });
}
