import type { EventType } from "@prisma/client";

// Section 6.2 — starting XP values. Seeded once into GamificationRule at
// `prisma/seed.ts` time; after that, the DB row is the source of truth —
// process-event.ts reads from GamificationRule, never from this constant.
// Editing a live value is a data change (update the row), not a deploy.
export const XP_RULES: Record<EventType, number> = {
  profile_completed: 50,
  comparison_viewed: 2,
  comparison_completed: 10,
  recommendation_viewed: 3,
  item_saved: 5,
  action_taken: 25,
  daily_visit: 5,
  chat_started: 5,
  advert_opened: 2,
};

export const XP_PER_LEVEL = 100;

/** Missing this many consecutive days still continues the streak (forgiving one lapse, not resetting to 1). */
export const STREAK_GRACE_DAYS = 1;

export function levelForXp(totalXp: number) {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(totalXp: number) {
  return totalXp % XP_PER_LEVEL;
}

export const BADGE_DEFS = [
  {
    name: "Profile complete",
    description: "Finished onboarding and set up your Kuwana profile.",
  },
  {
    name: "5 comparisons in one sector",
    description: "Completed 5 comparisons within a single sector.",
  },
  {
    name: "Multi-sector explorer",
    description: "Compared across 2 or more sectors — using the full breadth of Kuwana.",
  },
  {
    name: "7-day streak",
    description: "Visited Kuwana 7 days in a row.",
  },
] as const;

export type BadgeName = (typeof BADGE_DEFS)[number]["name"];

/**
 * Badge trigger specs, seeded into GamificationRule.badgeTrigger (jsonb) —
 * process-event.ts evaluates whatever's in the DB, not this constant. Kept
 * here only as what the seed writes on first run.
 */
export type BadgeTrigger =
  | { badge: BadgeName; type: "always" }
  | { badge: BadgeName; type: "event_count_in_sector"; count: number }
  | { badge: BadgeName; type: "distinct_sector_count"; count: number }
  | { badge: BadgeName; type: "streak_count"; count: number };

export const BADGE_TRIGGERS: Partial<Record<EventType, BadgeTrigger[]>> = {
  profile_completed: [{ badge: "Profile complete", type: "always" }],
  comparison_completed: [
    { badge: "5 comparisons in one sector", type: "event_count_in_sector", count: 5 },
    { badge: "Multi-sector explorer", type: "distinct_sector_count", count: 2 },
  ],
  daily_visit: [{ badge: "7-day streak", type: "streak_count", count: 7 }],
};

/** Event types whose GamificationRule carries `questTrigger: true` at seed time. */
export const QUEST_TRIGGER_EVENTS: EventType[] = ["comparison_completed", "daily_visit", "advert_opened"];

/**
 * Quest.criteria shapes the progress engine understands. "target" is the
 * count/streak length that completes the quest; "window" (days) restricts
 * counting to the quest's own activeFrom/activeTo span when unset.
 */
export type QuestCriteria =
  | { type: "category_count"; target: number }
  | { type: "comparison_count"; target: number }
  | { type: "sector_diversity"; target: number }
  | { type: "streak_count"; target: number }
  | { type: "advert_open_count"; target: number };
