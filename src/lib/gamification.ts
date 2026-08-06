/**
 * src/lib/gamification.ts
 * XP/badges/quests evaluated IN-TRANSACTION with triggering event (no queue)
 */
import { prisma } from './prisma'
import { EventType } from '@prisma/client'

export async function recordEventAndReward(userId: string, eventType: EventType, metadata: any = {}) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.userEvent.create({ data: { userId, eventType, metadata } })
    const rule = await tx.gamificationRule.findUnique({ where: { eventType } })
    if (!rule?.active) return { event, xpAwarded: 0 }

    const xp = await tx.userXp.upsert({
      where: { userId },
      update: { totalXp: { increment: rule.xpAward } },
      create: { userId, totalXp: rule.xpAward, level: 1 },
    })

    // level calc: every 500 xp = level up (example)
    const newLevel = Math.floor(xp.totalXp / 500) + 1
    if (newLevel !== xp.level) {
      await tx.userXp.update({ where: { userId }, data: { level: newLevel } })
    }

    // streak
    const streak = await tx.userStreak.upsert({
      where: { userId },
      update: { currentStreak: { increment: 1 }, lastActiveAt: new Date() },
      create: { userId, currentStreak: 1, longestStreak: 1, lastActiveAt: new Date() },
    })

    // badge check example
    if (eventType === 'FOOTPRINT_CREATED') {
      const count = await tx.sectorFootprint.count({ where: { userId } })
      if (count === 1) {
        const badge = await tx.badge.findUnique({ where: { name: 'First Footprint' } })
        if (badge) {
          await tx.userBadge.upsert({
            where: { userId_badgeId: { userId, badgeId: badge.id } },
            update: {},
            create: { userId, badgeId: badge.id },
          })
        }
      }
    }

    return { event, xpAwarded: rule.xpAward, xp, streak }
  })
}
