import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireAdmin } from "@/lib/auth";
import { boundedJsonRecord } from "@/lib/zodShared";
import { validateListingAttributes } from "@/lib/attributeValidation";
import { logAdminAction } from "@/lib/adminAudit";

/**
 * Admin content API — an alternative to hand-editing prisma/seed.ts for
 * every content change. Deliberately no UI yet, just an authenticated
 * surface; a real admin panel can be built against this later.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const categoryId = new URL(req.url).searchParams.get("categoryId");

  const listings = await prisma.listing.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: { provider: true, category: { include: { sector: true } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return privateJson({ listings });
}

const createSchema = z.object({
  categoryId: z.string(),
  providerId: z.string(),
  name: z.string().trim().min(1).max(200),
  attributes: boundedJsonRecord(50, 16_000),
  price: z.number().positive().max(100_000_000),
  currency: z.string().trim().length(3).default("USD"),
  sourceUrl: z.string().url().max(2000).optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const attrError = await validateListingAttributes(parsed.data.categoryId, parsed.data.attributes);
  if (attrError) return privateJson({ error: attrError }, { status: 400 });

  const listing = await prisma.listing.create({
    data: {
      ...parsed.data,
      attributes: parsed.data.attributes as Prisma.InputJsonValue,
      freshnessStatus: "fresh",
      lastVerifiedAt: new Date(),
    },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "listing_created",
    targetType: "listing",
    targetId: listing.id,
    detail: `Created "${listing.name}"`,
  });

  // The catalog read cache is keyed by tag, not by TTL alone — without
  // this, an edited price keeps serving stale until the 5-minute backstop.
  revalidateCatalog();
  return privateJson({ listing });
}
