import Link from "next/link";
import { Flame, Award, ShoppingBag, ChevronRight, Settings, Trophy, NotebookPen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SignalBloom } from "@/components/SignalBloom";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { XP_PER_LEVEL, xpIntoLevel } from "@/lib/gamification/rules";

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user) return null;

  const [profile, xp, streak, badges, savedCount] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.userXp.findUnique({ where: { userId: user.id } }),
    prisma.userStreak.findUnique({ where: { userId: user.id } }),
    prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
    prisma.savedListing.count({ where: { userId: user.id } }),
  ]);

  const totalXp = xp?.totalXp ?? 0;

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">
        {profile?.fullName ?? "Your profile"}
      </h1>
      <p className="text-[13px] text-text-secondary">{user.email}</p>

      <div className="mt-5 flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
        <SignalBloom value={(xpIntoLevel(totalXp) / XP_PER_LEVEL) * 100} size={88} />
        <div>
          <p className="font-display text-[18px] font-semibold">Level {xp?.level ?? 1}</p>
          <p className="text-[13px] text-text-secondary">
            {xpIntoLevel(totalXp)}/{XP_PER_LEVEL} XP to next level
          </p>
          <p className="mt-1 flex items-center gap-1 text-[13px] font-medium text-accent-coral">
            <Flame size={14} />
            {streak?.currentStreak ?? 0}-day streak
          </p>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-display text-[15px] font-semibold">Badges</h2>
        {badges.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-muted">
            Complete comparisons and actions to start earning badges.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {badges.map((b) => (
              <div
                key={b.badgeId}
                className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-accent-sky/30 bg-accent-sky/5 p-4 text-center"
              >
                <Award size={24} className="text-accent-sky" />
                <span className="text-[12px] font-semibold">{b.badge.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2.5">
        <Link
          href="/profile/quests"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4"
        >
          <div className="flex items-center gap-3">
            <Trophy size={18} className="text-accent-teal" />
            <span className="text-[14px] font-medium">Quests</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
        <Link
          href="/profile/saved"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag size={18} className="text-accent-teal" />
            <div>
              <p className="text-[14px] font-medium">Shopping list</p>
              <p className="text-[12px] text-text-muted">{savedCount} saved</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
        <Link
          href="/profile/notes"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4"
        >
          <div className="flex items-center gap-3">
            <NotebookPen size={18} className="text-accent-sky" />
            <span className="text-[14px] font-medium">My notes</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
        <Link
          href="/leaderboard"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4"
        >
          <div className="flex items-center gap-3">
            <Trophy size={18} className="text-accent-sky" />
            <span className="text-[14px] font-medium">Leaderboard</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
        <Link
          href="/settings"
          className="tap-target flex items-center justify-between rounded-xl border border-border bg-bg-surface px-4"
        >
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-text-secondary" />
            <span className="text-[14px] font-medium">Settings</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </Link>
      </div>

      <BottomTabBar />
    </div>
  );
}
