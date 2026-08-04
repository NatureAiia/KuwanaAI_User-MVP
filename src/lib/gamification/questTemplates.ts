import type { QuestCriteria } from "./rules";

export type QuestTemplate = {
  name: string;
  description: string;
  criteria: QuestCriteria;
  durationDays: number;
};

/**
 * Rotated through by scripts/quest-rotation — each covers a different
 * QuestCriteria type so the "this week's quest" varies rather than always
 * being the same category-count challenge. "Sector hopper" is deliberately
 * not named "Multi-sector explorer" — that name is already a Badge
 * (all-time, 2+ sectors ever) and this is the time-boxed weekly version.
 */
export const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    name: "Cross-sector explorer",
    description: "Compare listings in 3 different categories this week.",
    criteria: { type: "category_count", target: 3 },
    durationDays: 7,
  },
  {
    name: "Comparison streak",
    description: "Complete 5 comparisons this week, in any sector.",
    criteria: { type: "comparison_count", target: 5 },
    durationDays: 7,
  },
  {
    name: "Sector hopper",
    description: "Compare across 2 different sectors this week.",
    criteria: { type: "sector_diversity", target: 2 },
    durationDays: 7,
  },
  {
    name: "Week-long streak",
    description: "Visit Kuwana every day for 7 days straight.",
    criteria: { type: "streak_count", target: 7 },
    durationDays: 14,
  },
];
