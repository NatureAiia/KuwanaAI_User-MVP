import type { EventType, Sector, Prisma, PrismaClient, Quest, UserStreak } from "@prisma/client";
import { levelForXp, xpIntoLevel, XP_PER_LEVEL } from "./rules";
import type { BadgeTrigger, QuestCriteria } from "./rules";

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

async function awardBadgeIfNew(tx: Tx, userId: string, name: string, newBadges: GamificationState["newBadges"]) {
  const badge = await tx.badge.findUnique({ where: { name } });
  if (!badge) {
    // A badgeTrigger referencing a name with no matching Badge row is a
    // seed/data bug, not a request-time failure — surface it, don't 500.
    console.warn(`[gamification] badge "${name}" referenced by a trigger but not seeded — skipping`);
    return;
  }
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

/** Evaluates one badge trigger spec (from GamificationRule.badgeTrigger) against current state. */
async function evaluateBadgeTrigger(
  tx: Tx,
  trigger: BadgeTrigger,
  ctx: { userId: string; eventType: EventType; sector?: Sector | null; streak: UserStreak },
  newBadges: GamificationState["newBadges"],
) {
  switch (trigger.type) {
    case "always":
      await awardBadgeIfNew(tx, ctx.userId, trigger.badge, newBadges);
      return;

    case "event_count_in_sector": {
      if (!ctx.sector) return;
      const count = await tx.userEvent.count({
        where: { userId: ctx.userId, eventType: ctx.eventType, sector: ctx.sector },
      });
      if (count >= trigger.count) await awardBadgeIfNew(tx, ctx.userId, trigger.badge, newBadges);
      return;
    }

    case "distinct_sector_count": {
      const distinctSectors = await tx.userEvent.findMany({
        where: { userId: ctx.userId, eventType: ctx.eventType },
        distinct: ["sector"],
        select: { sector: true },
      });
      if (distinctSectors.filter((s) => s.sector).length >= trigger.count) {
        await awardBadgeIfNew(tx, ctx.userId, trigger.badge, newBadges);
      }
      return;
    }

    case "streak_count":
      if (ctx.streak.currentStreak >= trigger.count) {
        await awardBadgeIfNew(tx, ctx.userId, trigger.badge, newBadges);
      }
      return;
  }
}

/** Computes a quest's current progress, or null if this criteria type doesn't apply here. */
async function computeQuestProgress(
  tx: Tx,
  userId: string,
  quest: Quest,
  criteria: QuestCriteria,
  streak: UserStreak,
): Promise<number | null> {
  switch (criteria.type) {
    case "category_count": {
      const comparisons = await tx.comparison.findMany({
        where: { userId, createdAt: { gte: quest.activeFrom, lte: quest.activeTo } },
        distinct: ["categoryId"],
        select: { categoryId: true },
      });
      return comparisons.length;
    }

    case "comparison_count": {
      return tx.comparison.count({
        where: { userId, createdAt: { gte: quest.activeFrom, lte: quest.activeTo } },
      });
    }

    case "sector_diversity": {
      const comparisons = await tx.comparison.findMany({
        where: { userId, createdAt: { gte: quest.activeFrom, lte: quest.activeTo } },
        select: { category: { select: { sectorId: true } } },
      });
      return new Set(comparisons.map((c) => c.category.sectorId)).size;
    }

    case "streak_count":
      return streak.currentStreak;
  }
}

/**
 * Single entry point for the gamification engine (Section 6.5). Every
 * meaningful comparison/action writes here in the same transaction as the
 * triggering request — no background queue for MVP.
 *
 * XP values and badge/quest triggers are read from GamificationRule, not
 * hardcoded — editing them is a data change, not a deploy. See
 * prisma/seed.ts for what seeds those rows on first run.
 */
export async function recordEvent(
  tx: Tx,
  { userId, eventType, sector, metadata }: RecordEventInput,
): Promise<GamificationState> {
  const newBadges: GamificationState["newBadges"] = [];
  const now = new Date();

  const rule = await tx.gamificationRule.findUnique({ where: { eventType } });

  let streak = await tx.userStreak.findUnique({ where: { userId } });
  if (!streak) {
    streak = await tx.userStreak.create({ data: { userId } });
  }

  let awardXp = rule?.xpValue ?? 0;

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

  const badgeTriggers = (rule?.badgeTrigger as BadgeTrigger[] | null) ?? [];
  for (const trigger of badgeTriggers) {
    await evaluateBadgeTrigger(tx, trigger, { userId, eventType, sector, streak }, newBadges);
  }

  if (rule?.questTrigger) {
    const activeQuests = await tx.quest.findMany({
      where: { activeFrom: { lte: now }, activeTo: { gte: now } },
    });
    for (const quest of activeQuests) {
      const criteria = quest.criteria as QuestCriteria;
      const progress = await computeQuestProgress(tx, userId, quest, criteria, streak);
      if (progress == null) continue;
      const completed = progress >= criteria.target;

      await tx.userQuestProgress.upsert({
        where: { userId_questId: { userId, questId: quest.id } },
        update: { progress, completedAt: completed ? new Date() : undefined },
        create: { userId, questId: quest.id, progress, completedAt: completed ? new Date() : null },
      });
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
