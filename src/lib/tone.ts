export type Tone = "neutral" | "sky" | "teal" | "coral";

/**
 * Kuwana's admin/corporate surfaces only have four accent colors to work
 * with (see globals.css), reused across two independent axes of meaning —
 * this file is the one place both are defined, so a page can't invent a
 * third, incompatible mapping:
 *
 *  - Favorability: is this number better or worse for the account viewing
 *    it (cheaper vs. a competitor, below vs. above a peer median, price
 *    trending down vs. up)? teal = favorable, coral = unfavorable.
 *
 *  - Attention level: does this lifecycle/risk state need action? teal =
 *    resolved/positive, sky = in progress or moderate/needs some attention,
 *    coral = negative/unresolved/critical, neutral = inactive/no signal.
 *
 * Genuinely different statuses (e.g. a "pending" request vs. an "open"
 * investigation) can still map to different tones under the same rule — a
 * pending request hasn't been judged yet (sky), while an open investigation
 * already represents a flagged problem (coral) — the rule is what each
 * tone *means*, not that every status list looks identical.
 */
export function favorabilityTone(direction: "favorable" | "unfavorable" | "neutral"): Tone {
  return direction === "favorable" ? "teal" : direction === "unfavorable" ? "coral" : "neutral";
}

export const RISK_LEVEL_TONE = { low: "neutral", medium: "sky", high: "coral" } as const satisfies Record<
  string,
  Tone
>;
