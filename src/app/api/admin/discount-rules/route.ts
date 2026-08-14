import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z
  .object({
    providerId: z.string().uuid(),
    scope: z.enum(["category", "listing"]),
    categoryId: z.string().uuid().optional(),
    listingId: z.string().uuid().optional(),
    percentOff: z.coerce.number().min(0).max(100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((data) => (data.scope === "category" ? !!data.categoryId : !!data.listingId), {
    message: "categoryId is required for scope=category, listingId is required for scope=listing",
  })
  .refine((data) => data.endsAt > data.startsAt, { message: "endsAt must be after startsAt" });

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const discountRules = await prisma.discountRule.findMany({
    include: { provider: true, category: true, listing: true },
    orderBy: { createdAt: "desc" },
  });
  return privateJson({ discountRules });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const discountRule = await prisma.discountRule.create({
    data: {
      providerId: data.providerId,
      scope: data.scope,
      categoryId: data.scope === "category" ? data.categoryId : null,
      listingId: data.scope === "listing" ? data.listingId : null,
      percentOff: data.percentOff,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      createdByUserId: admin.id,
    },
    include: { provider: true, category: true, listing: true },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "discount_rule_created",
    targetType: "discount_rule",
    targetId: discountRule.id,
    detail: `${discountRule.provider.name}: ${data.percentOff}% off ${data.scope === "category" ? discountRule.category?.name : discountRule.listing?.name}`,
  });

  return privateJson({ discountRule });
}
