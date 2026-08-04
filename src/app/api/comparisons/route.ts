import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { recordEvent } from "@/lib/gamification/process-event";
import type { Sector } from "@prisma/client";

const bodySchema = z.object({
  categoryId: z.string(),
  listingIds: z.array(z.string()).min(2),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { categoryId, listingIds } = parsed.data;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { sector: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const result = await prisma.$transaction(
    async (tx) => {
      const comparison = await tx.comparison.create({
        data: { userId: user.id, categoryId, listingIds },
      });
      const gamification = await recordEvent(tx, {
        userId: user.id,
        eventType: "comparison_completed",
        sector: category.sector.slug as Sector,
        metadata: { categoryId, listingIds },
      });
      return { comparison, gamification };
    },
    { timeout: 15_000 },
  );

  return NextResponse.json(result);
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const comparisons = await prisma.comparison.findMany({
    where: { userId: user.id },
    include: { category: { include: { sector: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ comparisons });
}
