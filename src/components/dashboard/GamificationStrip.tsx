import Link from "next/link";
import { Flame } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { XP_PER_LEVEL, xpIntoLevel } from "@/lib/gamification/rules";

export function GamificationStrip({
  totalXp,
  level,
  currentStreak,
  activeQuestName,
}: {
  totalXp: number;
  level: number;
  currentStreak: number;
  activeQuestName: string | null;
}) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-bg-surface-raised px-4 py-3"
    >
      <SignalBloom value={(xpIntoLevel(totalXp) / XP_PER_LEVEL) * 100} size={48} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[14px] font-semibold">Level {level}</p>
        {activeQuestName ? (
          <p className="truncate text-[12px] text-text-secondary">Quest: {activeQuestName}</p>
        ) : (
          <p className="text-[12px] text-text-muted">No active quest</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-[13px] font-semibold text-accent-coral">
        <Flame size={16} />
        {currentStreak}
      </div>
    </Link>
  );
}
