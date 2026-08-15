import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  metric: z.enum(["total_providers", "published_listings", "pending_review_listings", "open_investigations", "pending_corporate_requests"]),
  direction: z.enum(["above", "below"]),
  threshold: z.number().positive(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const rule = await prisma.adminAlertRule.create({
    data: {
      createdByUserId: admin.id,
      metric: parsed.data.metric,
      direction: parsed.data.direction,
      threshold: parsed.data.threshold,
    },
  });

  return privateJson({ rule });
}
