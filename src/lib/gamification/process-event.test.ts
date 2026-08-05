import { describe, expect, it } from "vitest";
import { recordEvent } from "./process-event";
import type { BadgeTrigger, QuestCriteria } from "./rules";

/**
 * A lightweight, in-memory stand-in for the slice of Prisma's transaction
 * client process-event.ts actually calls — not a generic query engine, just
 * enough relational behavior (findUnique/create/update/upsert/count/
 * findMany with the specific where/distinct/select shapes this file issues)
 * to exercise the real business logic without a live database. Chosen over
 * a plain vi.fn() mock of every method because the interesting bugs here
 * are relational (does the count reflect what was actually created?, does
 * upsert correctly branch on existing rows?) — a fake with real state
 * catches those; a mock returning canned values per call wouldn't.
 */
function createFakeTx(rules: Record<string, { xpValue: number; badgeTrigger?: BadgeTrigger[]; questTrigger?: boolean }>) {
  const userStreaks = new Map<string, { userId: string; currentStreak: number; longestStreak: number; lastActiveDate: Date | null }>();
  const userXp = new Map<string, { userId: string; totalXp: number; level: number }>();
  const userEvents: { userId: string; eventType: string; sector: string | null }[] = [];
  const badges = new Map<string, { id: string; name: string; description: string }>();
  const userBadges = new Set<string>(); // `${userId}:${badgeId}`
  const comparisons: { userId: string; categoryId: string; sectorId: string; createdAt: Date }[] = [];
  const quests: { id: string; activeFrom: Date; activeTo: Date; criteria: QuestCriteria }[] = [];
  const questProgress = new Map<string, { userId: string; questId: string; progress: number; completedAt: Date | null }>();

  for (const [name] of [["Profile complete"], ["5 comparisons in one sector"], ["Multi-sector explorer"], ["7-day streak"]]) {
    badges.set(name, { id: name, name, description: name });
  }

  return {
    gamificationRule: {
      findUnique: async ({ where }: { where: { eventType: string } }) => {
        const rule = rules[where.eventType];
        return rule ? { eventType: where.eventType, ...rule } : null;
      },
    },
    userStreak: {
      findUnique: async ({ where }: { where: { userId: string } }) => userStreaks.get(where.userId) ?? null,
      create: async ({ data }: { data: { userId: string } }) => {
        const row = { userId: data.userId, currentStreak: 0, longestStreak: 0, lastActiveDate: null };
        userStreaks.set(data.userId, row);
        return row;
      },
      update: async ({ where, data }: { where: { userId: string }; data: Partial<{ currentStreak: number; longestStreak: number; lastActiveDate: Date }> }) => {
        const row = { ...userStreaks.get(where.userId)!, ...data };
        userStreaks.set(where.userId, row);
        return row;
      },
    },
    userEvent: {
      create: async ({ data }: { data: { userId: string; eventType: string; sector: string | null } }) => {
        userEvents.push(data);
        return data;
      },
      count: async ({ where }: { where: { userId: string; eventType: string; sector?: string | null } }) =>
        userEvents.filter((e) => e.userId === where.userId && e.eventType === where.eventType && (where.sector === undefined || e.sector === where.sector)).length,
      findMany: async ({ where }: { where: { userId: string; eventType: string } }) => {
        const rows = userEvents.filter((e) => e.userId === where.userId && e.eventType === where.eventType);
        const seen = new Set<string | null>();
        const distinct: { sector: string | null }[] = [];
        for (const r of rows) {
          if (seen.has(r.sector)) continue;
          seen.add(r.sector);
          distinct.push({ sector: r.sector });
        }
        return distinct;
      },
    },
    userXp: {
      findUnique: async ({ where }: { where: { userId: string } }) => userXp.get(where.userId) ?? null,
      create: async ({ data }: { data: { userId: string } }) => {
        const row = { userId: data.userId, totalXp: 0, level: 1 };
        userXp.set(data.userId, row);
        return row;
      },
      update: async ({ where, data }: { where: { userId: string }; data: { totalXp: number; level: number } }) => {
        const row = { userId: where.userId, ...data };
        userXp.set(where.userId, row);
        return row;
      },
    },
    badge: {
      findUnique: async ({ where }: { where: { name: string } }) => badges.get(where.name) ?? null,
    },
    userBadge: {
      findUnique: async ({ where }: { where: { userId_badgeId: { userId: string; badgeId: string } } }) =>
        userBadges.has(`${where.userId_badgeId.userId}:${where.userId_badgeId.badgeId}`) ? {} : null,
      create: async ({ data }: { data: { userId: string; badgeId: string } }) => {
        userBadges.add(`${data.userId}:${data.badgeId}`);
        return data;
      },
    },
    comparison: {
      findMany: async ({ where, select }: { where: { userId: string; createdAt: { gte: Date; lte: Date } }; select?: { category?: unknown } }) => {
        const rows = comparisons.filter(
          (c) => c.userId === where.userId && c.createdAt >= where.createdAt.gte && c.createdAt <= where.createdAt.lte,
        );
        if (select?.category) return rows.map((c) => ({ category: { sectorId: c.sectorId } }));
        // distinct categoryId case
        const seen = new Set<string>();
        const distinct: { categoryId: string }[] = [];
        for (const r of rows) {
          if (seen.has(r.categoryId)) continue;
          seen.add(r.categoryId);
          distinct.push({ categoryId: r.categoryId });
        }
        return distinct;
      },
      count: async ({ where }: { where: { userId: string; createdAt: { gte: Date; lte: Date } } }) =>
        comparisons.filter((c) => c.userId === where.userId && c.createdAt >= where.createdAt.gte && c.createdAt <= where.createdAt.lte).length,
    },
    quest: {
      findMany: async ({ where }: { where: { activeFrom: { lte: Date }; activeTo: { gte: Date } } }) =>
        quests.filter((q) => q.activeFrom <= where.activeFrom.lte && q.activeTo >= where.activeTo.gte),
    },
    userQuestProgress: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { userId_questId: { userId: string; questId: string } };
        update: { progress: number; completedAt?: Date };
        create: { userId: string; questId: string; progress: number; completedAt: Date | null };
      }) => {
        const key = `${where.userId_questId.userId}:${where.userId_questId.questId}`;
        const existing = questProgress.get(key);
        const row = existing
          ? { ...existing, progress: update.progress, completedAt: update.completedAt ?? existing.completedAt }
          : { userId: create.userId, questId: create.questId, progress: create.progress, completedAt: create.completedAt };
        questProgress.set(key, row);
        return row;
      },
    },
    // Test-only helpers, not part of the real Tx shape.
    _seed: { userStreaks, userXp, userEvents, comparisons, quests, questProgress, userBadges },
  };
}

describe("recordEvent", () => {
  it("awards XP from the rule and creates a fresh UserXp row on first event", async () => {
    const tx = createFakeTx({ comparison_completed: { xpValue: 10 } });
    const state = await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed" });
    expect(state.totalXp).toBe(10);
    expect(state.level).toBe(1);
  });

  it("crosses a level boundary correctly (delegates to levelForXp)", async () => {
    const tx = createFakeTx({ action_taken: { xpValue: 150 } });
    const state = await recordEvent(tx as never, { userId: "u1", eventType: "action_taken" });
    expect(state.totalXp).toBe(150);
    expect(state.level).toBe(2); // XP_PER_LEVEL is 100
  });

  it("awards zero XP and records no event-type crash for a rule-less event type", async () => {
    const tx = createFakeTx({});
    const state = await recordEvent(tx as never, { userId: "u1", eventType: "comparison_viewed" });
    expect(state.totalXp).toBe(0);
  });

  describe("daily_visit streak", () => {
    it("starts a streak at 1 on the first-ever visit", async () => {
      const tx = createFakeTx({ daily_visit: { xpValue: 5 } });
      const state = await recordEvent(tx as never, { userId: "u1", eventType: "daily_visit" });
      expect(state.currentStreak).toBe(1);
      expect(state.longestStreak).toBe(1);
      expect(state.totalXp).toBe(5);
    });

    it("doesn't double-count XP or streak on a second visit the same day", async () => {
      const tx = createFakeTx({ daily_visit: { xpValue: 5 } });
      await recordEvent(tx as never, { userId: "u1", eventType: "daily_visit" });
      const state = await recordEvent(tx as never, { userId: "u1", eventType: "daily_visit" });
      expect(state.currentStreak).toBe(1);
      expect(state.totalXp).toBe(5); // not 10
    });

    it("continues the streak the next day", async () => {
      const tx = createFakeTx({ daily_visit: { xpValue: 5 } });
      tx._seed.userStreaks.set("u1", {
        userId: "u1",
        currentStreak: 3,
        longestStreak: 3,
        lastActiveDate: new Date(Date.now() - 86_400_000), // yesterday
      });
      const state = await recordEvent(tx as never, { userId: "u1", eventType: "daily_visit" });
      expect(state.currentStreak).toBe(4);
      expect(state.longestStreak).toBe(4);
    });

    it("resets the streak to 1 after missing more than the grace window", async () => {
      const tx = createFakeTx({ daily_visit: { xpValue: 5 } });
      tx._seed.userStreaks.set("u1", {
        userId: "u1",
        currentStreak: 10,
        longestStreak: 10,
        lastActiveDate: new Date(Date.now() - 5 * 86_400_000), // 5 days ago, beyond grace
      });
      const state = await recordEvent(tx as never, { userId: "u1", eventType: "daily_visit" });
      expect(state.currentStreak).toBe(1);
      expect(state.longestStreak).toBe(10); // longest is a high-water mark, doesn't reset
    });
  });

  describe("badges", () => {
    it("awards an 'always' badge the first time and never again", async () => {
      const tx = createFakeTx({
        profile_completed: { xpValue: 50, badgeTrigger: [{ badge: "Profile complete", type: "always" }] },
      });
      const first = await recordEvent(tx as never, { userId: "u1", eventType: "profile_completed" });
      expect(first.newBadges.map((b) => b.name)).toEqual(["Profile complete"]);

      const second = await recordEvent(tx as never, { userId: "u1", eventType: "profile_completed" });
      expect(second.newBadges).toEqual([]);
    });

    it("awards an event_count_in_sector badge only once the threshold is reached", async () => {
      const tx = createFakeTx({
        comparison_completed: {
          xpValue: 10,
          badgeTrigger: [{ badge: "5 comparisons in one sector", type: "event_count_in_sector", count: 2 }],
        },
      });
      const first = await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed", sector: "banking" });
      expect(first.newBadges).toEqual([]);

      const second = await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed", sector: "banking" });
      expect(second.newBadges.map((b) => b.name)).toEqual(["5 comparisons in one sector"]);
    });

    it("awards a distinct_sector_count badge only once events span enough distinct sectors", async () => {
      const tx = createFakeTx({
        comparison_completed: {
          xpValue: 10,
          badgeTrigger: [{ badge: "Multi-sector explorer", type: "distinct_sector_count", count: 2 }],
        },
      });
      const first = await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed", sector: "banking" });
      expect(first.newBadges).toEqual([]);

      const second = await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed", sector: "telecom" });
      expect(second.newBadges.map((b) => b.name)).toEqual(["Multi-sector explorer"]);
    });
  });

  describe("quests", () => {
    it("upserts progress and marks completedAt once the target is reached", async () => {
      const now = new Date();
      const tx = createFakeTx({
        comparison_completed: { xpValue: 10, questTrigger: true },
      });
      tx._seed.quests.push({
        id: "q1",
        activeFrom: new Date(now.getTime() - 86_400_000),
        activeTo: new Date(now.getTime() + 86_400_000),
        criteria: { type: "comparison_count", target: 2 },
      });
      tx._seed.comparisons.push(
        { userId: "u1", categoryId: "c1", sectorId: "s1", createdAt: now },
        { userId: "u1", categoryId: "c2", sectorId: "s1", createdAt: now },
      );

      await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed" });

      const progress = tx._seed.questProgress.get("u1:q1");
      expect(progress?.progress).toBe(2);
      expect(progress?.completedAt).not.toBeNull();
    });

    it("leaves completedAt null while progress is below target", async () => {
      const now = new Date();
      const tx = createFakeTx({ comparison_completed: { xpValue: 10, questTrigger: true } });
      tx._seed.quests.push({
        id: "q1",
        activeFrom: new Date(now.getTime() - 86_400_000),
        activeTo: new Date(now.getTime() + 86_400_000),
        criteria: { type: "comparison_count", target: 5 },
      });
      tx._seed.comparisons.push({ userId: "u1", categoryId: "c1", sectorId: "s1", createdAt: now });

      await recordEvent(tx as never, { userId: "u1", eventType: "comparison_completed" });

      const progress = tx._seed.questProgress.get("u1:q1");
      expect(progress?.progress).toBe(1);
      expect(progress?.completedAt).toBeNull();
    });
  });
});
