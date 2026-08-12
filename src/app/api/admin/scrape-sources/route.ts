import { z } from "zod";
import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const sources = await prisma.scrapeSource.findMany({
    include: { category: { include: { sector: true } } },
    orderBy: { createdAt: "desc" },
  });
  return privateJson({ sources });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().url().max(2000),
  categoryId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const source = await prisma.scrapeSource.create({ data: parsed.data });
  await logAdminAction({
    adminEmail: admin.email,
    action: "scrape_source_created",
    targetType: "scrape_source",
    targetId: source.id,
    detail: `Added scrape source "${source.name}" (${source.url})`,
  });

  return privateJson({ source });
}
