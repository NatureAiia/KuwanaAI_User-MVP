/**
 * Starts the next quest when no quest is currently active — without this,
 * the app has exactly one quest forever (whatever was last seeded) and
 * "this week's quest" never actually changes once it expires. Run
 * manually or wire to an external scheduler, same pattern as
 * scripts/social-scan and scripts/freshness-decay.
 *
 *   npx tsx scripts/quest-rotation/run.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";
import { QUEST_TEMPLATES } from "@/lib/gamification/questTemplates";

/** Shared by the CLI entrypoint below and src/app/api/cron/quest-rotation/route.ts. */
export async function runQuestRotation() {
  const now = new Date();

  const active = await prisma.quest.findFirst({
    where: { activeFrom: { lte: now }, activeTo: { gte: now } },
  });
  if (active) {
    console.log(`[quest-rotation] "${active.name}" is still active until ${active.activeTo.toISOString()} — nothing to do.`);
    return { started: false, activeQuest: active.name, activeUntil: active.activeTo.toISOString() };
  }

  // Pick the next template so it doesn't repeat whatever ran last.
  const lastQuest = await prisma.quest.findFirst({ orderBy: { activeTo: "desc" } });
  const lastIndex = lastQuest ? QUEST_TEMPLATES.findIndex((t) => t.name === lastQuest.name) : -1;
  const next = QUEST_TEMPLATES[(lastIndex + 1) % QUEST_TEMPLATES.length];

  const activeTo = new Date(now.getTime() + next.durationDays * 86_400_000);
  const quest = await prisma.quest.create({
    data: { name: next.name, description: next.description, criteria: next.criteria, activeFrom: now, activeTo },
  });

  console.log(`[quest-rotation] started "${quest.name}" (${quest.id}), active until ${activeTo.toISOString()}.`);
  return { started: true, activeQuest: quest.name, activeUntil: activeTo.toISOString() };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runQuestRotation()
    .catch((err) => {
      console.error("[quest-rotation] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
