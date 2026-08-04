/**
 * Free social-media price scanner — run manually or wire to a scheduler:
 *
 *   npx tsx scripts/social-scan/run.ts
 *
 * Scans public sources for text that mentions a price, tags it with a known
 * provider name where one matches, and stores it in SocialPriceMention for
 * manual review. This is intelligence-gathering only — nothing here writes
 * to Listing/Provider directly; an admin decides what (if anything) to act
 * on. See config.ts to add channels/subreddits.
 *
 * Reddit needs no setup. Telegram needs a one-time free login — running
 * this without it configured just skips Telegram and prints how.
 */
import "dotenv/config";
import { scanReddit } from "./reddit";
import { scanTelegram } from "./telegram";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("[social-scan] starting…\n");

  const reddit = await scanReddit();
  if (!reddit.skipped) {
    console.log(`[reddit]   ${reddit.found} price mentions found, ${reddit.saved} saved/updated`);
  }

  const telegram = await scanTelegram();
  if (!telegram.skipped) {
    console.log(`[telegram] ${telegram.found} price mentions found, ${telegram.saved} saved/updated`);
  }

  console.log("\n[social-scan] done.");
}

main()
  .catch((err) => {
    console.error("[social-scan] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
