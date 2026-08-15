/**
 * Backfills missing subscriptions and rolls forward any whose billing period
 * has elapsed — see lib/subscriptions.ts. Runs daily rather than on a
 * calendar-month schedule: each account's period is monthly from whenever
 * its subscription started, so a daily sweep that only advances periods
 * that have actually elapsed is what keeps each account's own cycle
 * "monthly," staggered correctly per account.
 *
 *   npx tsx scripts/subscription-reset/run.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";
import { ensureAllSubscriptions } from "@/lib/subscriptions";

/** Shared by the CLI entrypoint below and src/app/api/cron/subscription-reset/route.ts. */
export async function runSubscriptionReset() {
  const result = await ensureAllSubscriptions();
  console.log(`[subscription-reset] created ${result.created}, rolled over ${result.rolled}.`);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runSubscriptionReset()
    .catch((err) => {
      console.error("[subscription-reset] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
