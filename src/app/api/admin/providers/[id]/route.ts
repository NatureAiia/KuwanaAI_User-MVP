import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().url().nullable().optional(),
  verified: z.boolean().optional(),
});

// No DELETE here deliberately — Provider -> Listing is onDelete: Cascade,
// so deleting a provider silently wipes every one of its listings. That's
// a decision an admin should make explicitly per-listing, not something
// a single API call should do as a side effect.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const provider = await prisma.provider.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ provider });
}
