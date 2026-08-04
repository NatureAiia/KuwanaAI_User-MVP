import { prisma } from "@/lib/prisma";
import { extractPrices } from "@/lib/social-scan/extractPrices";
import { matchProvider } from "@/lib/social-scan/matchProvider";
import { TELEGRAM_CHANNELS, FETCH_LIMIT } from "./config";

/**
 * Reads recent messages from PUBLIC Telegram channels via the official
 * MTProto user API (GramJS) — free, no paid tier, and reading a public
 * channel's own posted messages is exactly what that API is meant for
 * (unlike scraping Facebook/X/Instagram, which have no equivalent free
 * official route). One-time setup required — see printSetupInstructions().
 */
export async function scanTelegram() {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH;
  const sessionString = process.env.TELEGRAM_SESSION;

  if (!apiId || !apiHash || !sessionString) {
    printSetupInstructions();
    return { found: 0, saved: 0, skipped: true };
  }

  if (TELEGRAM_CHANNELS.length === 0) {
    console.warn("[telegram] TELEGRAM_CHANNELS in scripts/social-scan/config.ts is empty — nothing to scan.");
    return { found: 0, saved: 0, skipped: true };
  }

  // Lazy import: keeps this dependency out of the main Next.js bundle, and
  // avoids the module load (which touches Node crypto/net internals) for
  // anyone who only runs the Reddit scanner.
  const { TelegramClient } = await import("teleproto");
  const { StringSession } = await import("teleproto/sessions");

  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 3,
  });
  await client.connect();

  let found = 0;
  let saved = 0;

  try {
    for (const channel of TELEGRAM_CHANNELS) {
      let messages: Array<{ id: number; message?: string; date: number }> = [];
      try {
        messages = await client.getMessages(channel, { limit: FETCH_LIMIT });
      } catch (err) {
        console.warn(`[telegram] failed to read @${channel}: ${(err as Error).message}`);
        continue;
      }

      for (const msg of messages) {
        const text = msg.message ?? "";
        if (!text) continue;
        const prices = extractPrices(text);
        if (prices.length === 0) continue;

        found += 1;
        const sourceUrl = `https://t.me/${channel}/${msg.id}`;
        await prisma.socialPriceMention.upsert({
          where: { platform_sourceUrl: { platform: "telegram", sourceUrl } },
          update: {},
          create: {
            platform: "telegram",
            channel,
            sourceUrl,
            postedAt: new Date(msg.date * 1000),
            text: text.slice(0, 2000),
            matchedProvider: matchProvider(text),
            extractedPrices: prices,
          },
        });
        saved += 1;
      }
    }
  } finally {
    await client.disconnect();
  }

  return { found, saved, skipped: false };
}

function printSetupInstructions() {
  console.log(`
[telegram] Not configured — skipping. One-time setup (free):

  1. Go to https://my.telegram.org, log in with your phone number, and
     create an app under "API development tools". You'll get an
     api_id and api_hash — both free, no approval needed.

  2. Set these in your .env:
       TELEGRAM_API_ID=<your api_id>
       TELEGRAM_API_HASH=<your api_hash>

  3. Run a one-time interactive login to generate a session string
     (this logs in as your own Telegram account, same as opening the
     app — reading public channels doesn't require anything more):

       npx tsx scripts/social-scan/telegram-login.ts

     Paste the printed string into .env as TELEGRAM_SESSION — after
     that, this scanner runs unattended.

  4. Add public channel usernames to TELEGRAM_CHANNELS in
     scripts/social-scan/config.ts (the part after t.me/, no @).
`);
}
