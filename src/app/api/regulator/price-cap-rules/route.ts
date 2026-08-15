import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireRegulatorApiUser } from "@/lib/regulatorAuth";

const bodySchema = z.object({
  categoryId: z.string().uuid(),
  capValue: z.number().positive(),
  currency: z.string().trim().min(1).max(10).default("USD"),
});

export async function POST(req: Request) {
  const auth = await requireRegulatorApiUser();
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true } });
  if (!category) return privateJson({ error: "Category not found" }, { status: 404 });

  const rule = await prisma.priceCapRule.create({
    data: {
      categoryId: parsed.data.categoryId,
      capValue: parsed.data.capValue,
      currency: parsed.data.currency,
      createdByUserId: auth.user.id,
    },
  });

  return privateJson({ rule });
}
