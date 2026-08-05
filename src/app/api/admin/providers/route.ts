import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const providers = await prisma.provider.findMany({
    orderBy: { name: "asc" },
    include: { owner: { select: { email: true } } },
  });
  return NextResponse.json({ providers });
}

const createSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url().optional(),
  verified: z.boolean().default(true),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const provider = await prisma.provider.create({ data: parsed.data });
  return NextResponse.json({ provider });
}
