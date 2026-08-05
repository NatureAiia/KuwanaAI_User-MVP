import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { adminUserUpdateSchema } from "@/lib/adminUserSchema";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = adminUserUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const user = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true },
  });
  return privateJson({ user });
}
