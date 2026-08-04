import { prisma } from "@/lib/prisma";
import { extractPrices } from "@/lib/social-scan/extractPrices";
import { matchProvider } from "@/lib/social-scan/matchProvider";
import { REDDIT_SUBREDDITS, REDDIT_QUERY_TERMS, FETCH_LIMIT } from "./config";

// Reddit's anonymous JSON endpoints (www.reddit.com/.../search.json with no
// auth) now 403 most datacenter/script traffic — a real, observed change,
// not a hypothetical. The free OAuth "script app" flow below is the
// reliable path: register once at reddit.com/prefs/apps (free, instant,
// no approval wait), no scraping involved.
const USER_AGENT = "KuwanaPriceScanner/1.0 (contact: hello@kuwana.ai)";

type RedditPost = {
  data: {
    id: string;
    title: string;
    selftext: string;
    permalink: string;
    created_utc: number;
  };
};

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.warn(`[reddit] token request failed: HTTP ${res.status}`);
    return null;
  }
  const body = await res.json();
  return body.access_token ?? null;
}

async function searchSubreddit(token: string, subreddit: string, query: string): Promise<RedditPost[]> {
  const url = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/search?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=${FETCH_LIMIT}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    console.warn(`[reddit] r/${subreddit} "${query}" failed: HTTP ${res.status}`);
    return [];
  }
  const body = await res.json();
  return body?.data?.children ?? [];
}

export async function scanReddit() {
  const token = await getAccessToken();
  if (!token) {
    printSetupInstructions();
    return { found: 0, saved: 0, skipped: true };
  }

  let found = 0;
  let saved = 0;

  for (const subreddit of REDDIT_SUBREDDITS) {
    for (const query of REDDIT_QUERY_TERMS) {
      const posts = await searchSubreddit(token, subreddit, query);
      // Free-tier OAuth apps are limited to ~60 req/min — stay well under that.
      await new Promise((r) => setTimeout(r, 1200));

      for (const post of posts) {
        const text = `${post.data.title}\n${post.data.selftext ?? ""}`;
        const prices = extractPrices(text);
        if (prices.length === 0) continue;

        found += 1;
        const sourceUrl = `https://www.reddit.com${post.data.permalink}`;
        await prisma.socialPriceMention.upsert({
          where: { platform_sourceUrl: { platform: "reddit", sourceUrl } },
          update: {},
          create: {
            platform: "reddit",
            channel: subreddit,
            sourceUrl,
            postedAt: new Date(post.data.created_utc * 1000),
            text: text.slice(0, 2000),
            matchedProvider: matchProvider(text),
            extractedPrices: prices,
          },
        });
        saved += 1;
      }
    }
  }

  return { found, saved, skipped: false };
}

function printSetupInstructions() {
  console.log(`
[reddit] Not configured — skipping. One-time setup (free, instant):

  1. Go to https://www.reddit.com/prefs/apps (log in first), click
     "create another app...", choose type "script", any name/redirect
     URI (e.g. http://localhost:8080).

  2. Reddit shows a client ID (under the app name) and a secret. Set
     these in your .env:
       REDDIT_CLIENT_ID=<client id>
       REDDIT_CLIENT_SECRET=<secret>

  No approval wait, no cost — this is a standard free developer app,
  same tier every Reddit bot/tool uses.
`);
}
