import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const { id } = await params;
  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
