import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return privateJson({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });
  if (result.count === 0) return privateJson({ error: "Not found" }, { status: 404 });

  return privateJson({ ok: true });
}
