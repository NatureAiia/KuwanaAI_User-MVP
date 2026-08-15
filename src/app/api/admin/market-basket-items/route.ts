import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  basketName: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  listingId: z.string().uuid(),
  weight: z.coerce.number().positive().default(1),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const items = await prisma.marketBasketItem.findMany({
    include: { listing: { select: { name: true } } },
    orderBy: [{ basketName: "asc" }, { createdAt: "asc" }],
  });
  return privateJson({ items });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  const listing = await prisma.listing.findUnique({ where: { id: data.listingId }, select: { id: true } });
  if (!listing) return privateJson({ error: "Listing not found" }, { status: 404 });

  const existing = await prisma.marketBasketItem.findUnique({
    where: { basketName_listingId: { basketName: data.basketName, listingId: data.listingId } },
  });
  if (existing) return privateJson({ error: "This listing is already a component of that basket" }, { status: 400 });

  const item = await prisma.marketBasketItem.create({
    data: { basketName: data.basketName, label: data.label, listingId: data.listingId, weight: data.weight },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "market_basket_item_created",
    targetType: "market_basket_item",
    targetId: item.id,
    detail: `${item.basketName}: ${item.label}`,
  });

  return privateJson({ item });
}
