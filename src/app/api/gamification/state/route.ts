import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { XP_PER_LEVEL, xpIntoLevel } from "@/lib/gamification/rules";

export async function GET() {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const [xp, streak, badges, activeQuests] = await Promise.all([
    prisma.userXp.findUnique({ where: { userId: user.id } }),
    prisma.userStreak.findUnique({ where: { userId: user.id } }),
    prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
    prisma.quest.findMany({
      where: { activeTo: { gte: new Date() } },
      include: { progress: { where: { userId: user.id } } },
    }),
  ]);

  const totalXp = xp?.totalXp ?? 0;

  return NextResponse.json({
    totalXp,
    level: xp?.level ?? 1,
    xpIntoLevel: xpIntoLevel(totalXp),
    xpPerLevel: XP_PER_LEVEL,
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    badges: badges.map((b) => ({
      name: b.badge.name,
      description: b.badge.description,
      earnedAt: b.earnedAt,
    })),
    quests: activeQuests.map((q) => ({
      name: q.name,
      description: q.description,
      progress: q.progress[0]?.progress ?? 0,
      target: (q.criteria as { target?: number }).target ?? null,
      completedAt: q.progress[0]?.completedAt ?? null,
      activeTo: q.activeTo,
    })),
  });
}
