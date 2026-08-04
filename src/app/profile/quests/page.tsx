import { CheckCircle2, Circle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { DynamicBar } from "@/components/ui/DynamicBar";
import { GlowBorder } from "@/components/ui/GlowBorder";

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
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Quests</h1>
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
            <GlowBorder key={quest.id} className="bg-bg-surface p-4">
              <div className="flex items-center gap-2">
                {completed ? (
                  <CheckCircle2 size={18} className="text-accent-teal" />
                ) : (
                  <Circle size={18} className="text-text-muted" />
                )}
                <p className="font-display text-[15px] font-semibold">{quest.name}</p>
              </div>
              <p className="mt-1 text-[13px] text-text-secondary">{quest.description}</p>
              <div className="mt-3">
                <DynamicBar value={pct} color="teal" />
              </div>
              <p className="mt-1.5 text-[11px] text-text-muted">
                {progress}/{target} · ends {quest.activeTo.toLocaleDateString()}
              </p>
            </GlowBorder>
          );
        })}
      </div>

      <BottomTabBar />
    </div>
  );
}
