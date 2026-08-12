import type { EventType } from "@prisma/client";

/**
 * Which events /api/events will accept from a browser.
 *
 * The route previously accepted seven of the eight EventType values, which
 * meant any signed-in account could POST `item_saved` or
 * `comparison_completed` in a loop and mint XP, badges, quest progress, and
 * leaderboard rank without ever comparing anything. Four of those seven are
 * *already* recorded server-side by the route that actually performs the
 * action — /api/saved, /api/comparisons, /api/recommendations,
 * /api/onboarding each call recordEvent themselves — so accepting them here
 * was duplicated bookkeeping as well as a farming hole.
 *
 * What remains are the three signals the server genuinely cannot observe on
 * its own: the user opened a comparison view, clicked out to a provider, or
 * showed up today.
 */
export const CLIENT_REPORTABLE_EVENTS = [
  "comparison_viewed",
  "action_taken",
  "daily_visit",
] as const satisfies readonly EventType[];

export type ClientReportableEvent = (typeof CLIENT_REPORTABLE_EVENTS)[number];

/**
 * Minimum seconds between two payouts of the same event type for one user.
 *
 * Tuned to be invisible in real use and fatal to a replay loop:
 * `comparison_viewed` fires once per opened comparison (a human takes far
 * longer than 30s to read one), `action_taken` guards a click-out to a
 * provider, and `daily_visit` is once-a-day by definition — recordEvent
 * already zeroes its XP on a same-day repeat, so this just stops the write.
 */
export const EVENT_COOLDOWN_SECONDS: Record<ClientReportableEvent, number> = {
  comparison_viewed: 30,
  action_taken: 30,
  daily_visit: 12 * 60 * 60,
};
