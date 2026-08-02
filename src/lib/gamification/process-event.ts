import type { EventType, Sector, Prisma, PrismaClient } from "@prisma/client";
import { BADGE_DEFS, XP_RULES, levelForXp, xpIntoLevel, XP_PER_LEVEL } from "./rules";

type Tx = PrismaClient | Prisma.TransactionClient;

export type RecordEventInput = {
  userId: string;
  eventType: EventType;
  sector?: Sector | null;
  metadata?: Record<string, unknown>;
};

export type GamificationState = {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  currentStreak: number;
  longestStreak: number;
  newBadges: { name: string; description: string }[];
};

async function getOrCreateBadge(tx: Tx, name: string) {
  const existing = await tx.badge.findUnique({ where: { name } });
  if (existing) return existing;
  const def = BADGE_DEFS.find((b) => b.name === name)!;
  return tx.badge.create({
    data: { name: def.name, description: def.description, criteria: {} },
  });
}

async function awardBadgeIfNew(tx: Tx, userId: string, name: string, newBadges: GamificationState["newBadges"]) {
  const badge = await getOrCreateBadge(tx, name);
  const already = await tx.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (already) return;
  await tx.userBadge.create({ data: { userId, badgeId: badge.id } });
  newBadges.push({ name: badge.name, description: badge.description });
}

function isSameDay(a: Date, b: Date) {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/**
 * Single entry point for the gamification engine (Section 6.5). Every
 * meaningful comparison/action writes here in the same transaction as the
 * triggering request — no background queue for MVP.
 */
export async function recordEvent(
  tx: Tx,
  { userId, eventType, sector, metadata }: RecordEventInput,
): Promise<GamificationState> {
  const newBadges: GamificationState["newBadges"] = [];
  const now = new Date();

  let streak = await tx.userStreak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await tx.userStreak.create({ data: { userId } });
  }

  let awardXp = XP_RULES[eventType] ?? 0;

  if (eventType === "daily_visit") {
    const alreadyVisitedToday = streak.lastActiveDate && isSameDay(streak.lastActiveDate, now);
    if (alreadyVisitedToday) {
      awardXp = 0;
    } else {
      const wasYesterday =
        streak.lastActiveDate &&
        isSameDay(new Date(streak.lastActiveDate.getTime() + 86_400_000), now);
      const nextStreak = wasYesterday ? streak.currentStreak + 1 : 1;
      streak = await tx.userStreak.update({
        where: { userId },
        data: {
          currentStreak: nextStreak,
          longestStreak: Math.max(nextStreak, streak.longestStreak),
          lastActiveDate: now,
        },
      });
      if (streak.currentStreak >= 7) {
        await awardBadgeIfNew(tx, userId, "7-day streak", newBadges);
      }
    }
  }

  await tx.userEvent.create({
    data: { userId, eventType, sector: sector ?? null, metadata: metadata as Prisma.InputJsonValue },
  });

  let xp = await tx.userXp.findUnique({ where: { userId } });
  if (!xp) xp = await tx.userXp.create({ data: { userId } });
  if (awardXp > 0) {
    const totalXp = xp.totalXp + awardXp;
    xp = await tx.userXp.update({
      where: { userId },
      data: { totalXp, level: levelForXp(totalXp) },
    });
  }

  if (eventType === "profile_completed") {
    await awardBadgeIfNew(tx, userId, "Profile complete", newBadges);
  }

  if (eventType === "comparison_completed" && sector) {
    const sectorCount = await tx.userEvent.count({
      where: { userId, eventType: "comparison_completed", sector },
    });
    if (sectorCount >= 5) {
      await awardBadgeIfNew(tx, userId, "5 comparisons in one sector", newBadges);
    }

    const distinctSectors = await tx.userEvent.findMany({
      where: { userId, eventType: "comparison_completed" },
      distinct: ["sector"],
      select: { sector: true },
    });
    if (distinctSectors.filter((s) => s.sector).length >= 2) {
      await awardBadgeIfNew(tx, userId, "Multi-sector explorer", newBadges);
    }

    const categoryId = metadata?.categoryId as string | undefined;
    if (categoryId) {
      const activeQuests = await tx.quest.findMany({
        where: { activeFrom: { lte: now }, activeTo: { gte: now } },
      });
      for (const quest of activeQuests) {
        const criteria = quest.criteria as { type?: string; target?: number };
        if (criteria.type !== "category_count") continue;

        const comparisonsInWindow = await tx.comparison.findMany({
          where: { userId, createdAt: { gte: quest.activeFrom, lte: quest.activeTo } },
          distinct: ["categoryId"],
          select: { categoryId: true },
        });
        const progress = comparisonsInWindow.length;
        const completed = criteria.target != null && progress >= criteria.target;

        await tx.userQuestProgress.upsert({
          where: { userId_questId: { userId, questId: quest.id } },
          update: { progress, completedAt: completed ? new Date() : undefined },
          create: { userId, questId: quest.id, progress, completedAt: completed ? new Date() : null },
        });
      }
    }
  }

  return {
    totalXp: xp.totalXp,
    level: xp.level,
    xpIntoLevel: xpIntoLevel(xp.totalXp),
    xpPerLevel: XP_PER_LEVEL,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    newBadges,
  };
}
