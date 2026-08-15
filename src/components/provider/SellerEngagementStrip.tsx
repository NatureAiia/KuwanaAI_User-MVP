import { Flame, Award } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { XP_PER_LEVEL, xpIntoLevel } from "@/lib/gamification/rules";

export function SellerEngagementStrip({
  totalXp,
  level,
  currentStreak,
  badges,
}: {
  totalXp: number;
  level: number;
  currentStreak: number;
  badges: { name: string }[];
}) {
  return (
    <div className="mt-5 flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <SignalBloom value={(xpIntoLevel(totalXp) / XP_PER_LEVEL) * 100} size={72} />
        <div>
          <p className="font-display text-[16px] font-semibold">Level {level} seller</p>
          <p className="text-[13px] text-text-secondary">
            {xpIntoLevel(totalXp)}/{XP_PER_LEVEL} XP to next level
          </p>
          <p className="mt-1 flex items-center gap-1 text-[13px] font-medium text-accent-coral">
            <Flame size={14} />
            {currentStreak}-day streak
          </p>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {badges.map((b) => (
            <span
              key={b.name}
              className="flex items-center gap-1.5 rounded-full border border-accent-sky/30 bg-accent-sky/5 px-3 py-1.5 text-[12px] font-semibold text-accent-sky"
            >
              <Award size={14} />
              {b.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
