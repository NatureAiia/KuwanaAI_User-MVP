import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(["regulatory", "competitor", "macro"]),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  reviewCycleDays: z.number().int().positive().max(3650).optional(),
  notes: z.string().trim().max(2000).optional(),
  documentUrls: z.array(z.string().url()).max(20).default([]),
  sectorSlug: z.string().trim().max(40).optional(),
  assignedToUserId: z.string().uuid().optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const conditions = await prisma.businessCondition.findMany({
    include: { assignedTo: { select: { email: true } } },
    orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
  });
  return privateJson({ conditions });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const condition = await prisma.businessCondition.create({ data: parsed.data });

  await logAdminAction({
    adminEmail: admin.email,
    action: "business_condition_created",
    targetType: "business_condition",
    targetId: condition.id,
    detail: `${condition.category}/${condition.riskLevel}: "${condition.title}"`,
  });

  return privateJson({ condition });
}
