import type { EventType } from "@prisma/client";

// Section 6.2 — starting XP values.
export const XP_RULES: Record<EventType, number> = {
  profile_completed: 50,
  comparison_viewed: 2,
  comparison_completed: 10,
  recommendation_viewed: 3,
  item_saved: 5,
  action_taken: 25,
  daily_visit: 5,
  chat_started: 5,
};

export const XP_PER_LEVEL = 100;

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
