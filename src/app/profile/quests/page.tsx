import { CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";

export default async function QuestsPage() {
  const user = await requireUser();
  if (!user) return null;

  const quests = await prisma.quest.findMany({
    where: { activeTo: { gte: new Date() } },
    include: { progress: { where: { userId: user.id } } },
    orderBy: { activeTo: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Quests</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Time-boxed challenges that reward XP.</p>

      <div className="mt-5 space-y-3">
        {quests.length === 0 && (
          <p className="text-[13px] text-text-muted">No active quests right now — check back soon.</p>
        )}
        {quests.map((quest) => {
          const progress = quest.progress[0]?.progress ?? 0;
          const target = (quest.criteria as { target?: number }).target ?? 1;
          const completed = !!quest.progress[0]?.completedAt;
          const pct = Math.min(100, Math.round((progress / target) * 100));

          return (
            <div key={quest.id} className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-4">
              <div className="flex items-center gap-2">
                {completed ? (
                  <CheckCircle2 size={18} className="text-accent-teal" />
                ) : (
                  <Circle size={18} className="text-text-muted" />
                )}
                <p className="font-display text-[15px] font-semibold">{quest.name}</p>
              </div>
              <p className="mt-1 text-[13px] text-text-secondary">{quest.description}</p>
              <div className="mt-3 h-1.5 w-full rounded-full bg-bg-surface-raised">
                <div
                  className="h-1.5 rounded-full bg-accent-teal transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-text-muted">
                {progress}/{target} · ends {quest.activeTo.toLocaleDateString()}
              </p>
            </div>
          );
        })}
      </div>

      <BottomTabBar />
    </div>
  );
}
