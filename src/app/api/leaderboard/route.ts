import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const consent = await prisma.consent.findUnique({
    where: { userId_consentType: { userId: user.id, consentType: "leaderboard_participation" } },
  });

  if (!consent?.granted) {
    return NextResponse.json({ optedIn: false, entries: [] });
  }

  const optedInUserIds = await prisma.consent.findMany({
    where: { consentType: "leaderboard_participation", granted: true },
    select: { userId: true },
  });

  const entries = await prisma.userXp.findMany({
    where: { userId: { in: optedInUserIds.map((c) => c.userId) } },
    include: { user: { include: { profile: true } } },
    orderBy: { totalXp: "desc" },
    take: 50,
  });

  return NextResponse.json({
    optedIn: true,
    entries: entries.map((e, i) => ({
      rank: i + 1,
      nickname: e.user.profile?.nickname || `Player${e.userId.slice(0, 4)}`,
      totalXp: e.totalXp,
      level: e.level,
      isYou: e.userId === user.id,
    })),
  });
}
