"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Button } from "@/components/ui/Button";

type Entry = { rank: number; nickname: string; totalXp: number; level: number; isYou: boolean };

export default function LeaderboardPage() {
  const [data, setData] = useState<{ optedIn: boolean; entries: Entry[] } | null>(null);
  const [optingIn, setOptingIn] = useState(false);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  async function optIn() {
    setOptingIn(true);
    await fetch("/api/settings/consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaderboard_participation: true }),
    });
    const res = await fetch("/api/leaderboard");
    setData(await res.json());
    setOptingIn(false);
  }

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Leaderboard</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Opt-in only. Shown under a nickname — never your real name.
      </p>

      {!data ? (
        <p className="mt-6 text-text-muted">Loading…</p>
      ) : !data.optedIn ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-6 text-center">
          <Trophy size={28} className="mx-auto text-accent-gold" />
          <p className="mt-3 font-display text-[16px] font-semibold">Join the leaderboard</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            Compare your XP with other Kuwana users under a chosen nickname.
          </p>
          <Button onClick={optIn} disabled={optingIn} className="mt-4">
            {optingIn ? "Joining…" : "Opt in"}
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {data.entries.map((e) => (
            <div
              key={e.rank}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                e.isYou ? "border-accent-gold bg-accent-gold/10" : "border-border bg-bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-mono text-[13px] text-text-muted">
                  {e.rank}
                </span>
                <span className="text-[14px] font-medium">{e.nickname}</span>
              </div>
              <span className="font-mono text-[13px] text-text-secondary">
                Lvl {e.level} · {e.totalXp} XP
              </span>
            </div>
          ))}
        </div>
      )}

      <BottomTabBar />
    </div>
  );
}
