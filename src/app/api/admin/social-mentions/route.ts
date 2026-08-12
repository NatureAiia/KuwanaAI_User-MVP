import { privateJson } from "@/lib/apiResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const showReviewed = new URL(req.url).searchParams.get("reviewed") === "true";

  const mentions = await prisma.socialPriceMention.findMany({
    where: { reviewed: showReviewed },
    orderBy: { discoveredAt: "desc" },
    take: 100,
  });

  return privateJson({ mentions });
}

const patchSchema = z.object({ id: z.string(), reviewed: z.boolean() });

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.socialPriceMention.update({
    where: { id: parsed.data.id },
    data: { reviewed: parsed.data.reviewed },
  });

  return privateJson({ ok: true });
}
