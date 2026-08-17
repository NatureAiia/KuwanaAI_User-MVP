import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidateCatalog } from "@/lib/cacheTags";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const providers = await prisma.provider.findMany({
    orderBy: { name: "asc" },
    include: { owner: { select: { email: true } } },
    take: 500,
  });
  return privateJson({ providers });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  logoUrl: z.string().url().max(2000).optional(),
  websiteUrl: z.string().url().max(2000).optional(),
  verified: z.boolean().default(true),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const provider = await prisma.provider.create({ data: parsed.data });

  await logAdminAction({
    adminEmail: admin.email,
    action: "provider_created",
    targetType: "provider",
    targetId: provider.id,
    detail: `Created "${provider.name}"`,
  });

  // The catalog read cache is keyed by tag, not by TTL alone — without
  // this, an edited price keeps serving stale until the 5-minute backstop.
  revalidateCatalog();
  return privateJson({ provider });
}
