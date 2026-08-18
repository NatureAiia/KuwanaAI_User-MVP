import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const users = await prisma.user.findMany({
    // Excludes accounts still mid-signup (registered via /api/auth/register
    // but never finished /api/onboarding) — a real row exists but there's
    // nothing yet to review or manage here.
    where: { onboardingCompletedAt: { not: null } },
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return privateJson({ users });
}
