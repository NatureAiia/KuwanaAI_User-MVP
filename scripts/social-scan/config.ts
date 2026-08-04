/**
 * What to scan. Edit these lists to add/remove sources — no code changes
 * needed elsewhere. Keep to PUBLIC channels/subreddits only.
 */

/** Public Telegram channel usernames (the part after t.me/), no @ prefix. */
export const TELEGRAM_CHANNELS: string[] = [
  // e.g. "econetpromos", "cbzbank" — add real public channel usernames here.
];

export const REDDIT_SUBREDDITS: string[] = ["Zimbabwe", "harare"];

/** Search terms run against each subreddit — kept broad, extractPrices() filters the noise. */
export const REDDIT_QUERY_TERMS: string[] = [
  "bundle",
  "data plan",
  "airtime",
  "tariff",
  "loan rate",
  "premium",
  "price increase",
];

/** How many recent messages/posts to pull per source per run. */
export const FETCH_LIMIT = 25;
