"use client";

import { useEffect, useState } from "react";
import { Award, Sparkles } from "lucide-react";
import { onGamificationUpdate, type GamificationUpdate } from "@/lib/gamification/client";

type Toast = { id: number; kind: "xp" | "badge"; text: string };

let idCounter = 0;

export function GamificationToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return onGamificationUpdate((update: GamificationUpdate) => {
      const next: Toast[] = [];
      if (update.newBadges?.length) {
        for (const badge of update.newBadges) {
          next.push({ id: idCounter++, kind: "badge", text: `Badge unlocked: ${badge.name}` });
        }
      }
      if (next.length === 0) return;
      setToasts((prev) => [...prev, ...next]);
      next.forEach((t) => {
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4000);
      });
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-2 rounded-full border border-accent-sky bg-bg-surface px-4 py-2.5 text-[13px] font-semibold text-text-primary shadow-[0_8px_30px_rgba(0,0,0,0.3)]"
        >
          {t.kind === "badge" ? (
            <Award size={16} className="text-accent-sky" />
          ) : (
            <Sparkles size={16} className="text-accent-sky" />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}
