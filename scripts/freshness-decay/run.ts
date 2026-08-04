/**
 * Recomputes every listing's freshness status from how long ago it was
 * last verified, instead of leaving whatever was set at seed/creation time
 * to sit unrevisited forever. Run manually or wire to an external
 * scheduler (cron, GitHub Actions, etc.) — same pattern as
 * scripts/social-scan, no in-process timer inside the Next.js server
 * (a persistent timer there would double up under dev-mode hot reload).
 *
 *   npx tsx scripts/freshness-decay/run.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { computeFreshnessStatus } from "@/lib/freshness";

async function main() {
  const listings = await prisma.listing.findMany({
    select: { id: true, name: true, freshnessStatus: true, lastVerifiedAt: true },
  });
  const now = new Date();

  let updated = 0;
  for (const listing of listings) {
    const next = computeFreshnessStatus(listing.lastVerifiedAt, now);
    if (next === listing.freshnessStatus) continue;

    await prisma.listing.update({ where: { id: listing.id }, data: { freshnessStatus: next } });
    updated += 1;
    console.log(`[freshness] ${listing.name}: ${listing.freshnessStatus} -> ${next}`);
  }

  console.log(`\n[freshness] checked ${listings.length} listings, updated ${updated}.`);
}

main()
  .catch((err) => {
    console.error("[freshness] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
