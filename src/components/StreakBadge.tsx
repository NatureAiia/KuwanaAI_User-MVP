"use client";

import Link from "next/link";
import { Flame } from "lucide-react";

/**
 * Compact streak indicator for the top-nav header — sits to the left of the
 * notification bell. Circular tap-target styling matches the Bell and
 * ThemeToggle buttons so the three chrome elements read as a matched row.
 * Same accent-coral color the dashboard's old GamificationStrip used, so the
 * streak keeps its visual identity after the strip was removed.
 *
 * Hidden when there's no streak yet (currentStreak === 0) so a brand-new
 * account doesn't show a "0" pill in the chrome.
 */
export function StreakBadge({ currentStreak }: { currentStreak: number }) {
  if (currentStreak <= 0) return null;
  return (
    <Link
      href="/profile"
      aria-label={`${currentStreak}-day streak — open profile`}
      className="tap-target relative flex items-center justify-center gap-1 rounded-full border border-border bg-bg-surface px-2 text-accent-coral"
    >
      <Flame size={16} />
      <span className="text-[12px] font-semibold tabular-nums">{currentStreak}</span>
    </Link>
  );
}
