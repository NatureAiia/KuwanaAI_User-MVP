"use client";

import { useEffect, useRef } from "react";
import { Bell, Flame } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";

const BASE_ROT_Y = -12;
const BASE_ROT_X = 6;

/**
 * A mouse-tilted mockup of the actual dashboard — Signal Bloom scores, the
 * streak/level chip, an explained recommendation — not stand-in fintech
 * copy, so the hero doubles as a preview of the real product.
 */
export function HeroDeviceMockup() {
  const visualRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const visual = visualRef.current;
    const stage = stageRef.current;
    if (!visual || !stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const reset = () => {
      stage.style.transform = `rotateY(${BASE_ROT_Y}deg) rotateX(${BASE_ROT_X}deg)`;
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = visual.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      stage.style.transform = `rotateY(${BASE_ROT_Y + px * 14}deg) rotateX(${BASE_ROT_X - py * 10}deg)`;
    };

    reset();
    visual.addEventListener("mousemove", onMouseMove);
    visual.addEventListener("mouseleave", reset);
    return () => {
      visual.removeEventListener("mousemove", onMouseMove);
      visual.removeEventListener("mouseleave", reset);
    };
  }, []);

  return (
    <div ref={visualRef} className="relative mx-auto w-full max-w-[380px] [perspective:1400px]">
      <div
        ref={stageRef}
        className="relative rounded-[28px] border border-border bg-bg-surface p-4 shadow-2xl transition-transform duration-300 ease-out will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div className="flex items-center justify-between" data-scan>
          <span className="text-[11px] font-medium text-text-secondary">Welcome back, Tendai</span>
          <span className="relative flex items-center justify-center rounded-full border border-border bg-bg-surface-raised p-1.5">
            <Bell size={13} className="text-text-muted" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-coral" />
          </span>
        </div>

        <p className="mt-3 font-display text-[15px] font-bold leading-tight">Your best options this week</p>
        <p className="text-[11px] text-text-muted">Across telecom, banking &amp; insurance</p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface-raised p-2.5"
            data-scan
          >
            <SignalBloom value={92} size={40} strokeWidth={4} />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold leading-tight">10GB Bundle</p>
              <p className="text-[10px] text-text-muted">NetOne</p>
            </div>
          </div>
          <div
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface-raised p-2.5"
            data-scan
          >
            <SignalBloom value={87} size={40} strokeWidth={4} color="teal" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold leading-tight">Savings account</p>
              <p className="text-[10px] text-text-muted">CBZ</p>
            </div>
          </div>
        </div>

        <div
          className="mt-2 flex items-center justify-between rounded-xl border border-border bg-bg-surface-raised px-3 py-2.5"
          data-scan
        >
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-accent-coral" />
            <span className="text-[12px] font-semibold">6-day streak</span>
          </div>
          <span className="font-mono text-[10.5px] text-text-muted">Level 4</span>
        </div>

        <div className="mt-2 rounded-xl border border-border bg-bg-surface-raised p-3" data-scan>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
            Top recommendation
          </p>
          <p className="mt-1 font-display text-[13px] font-semibold">NetOne 10GB Bundle</p>
          <ul className="mt-1.5 space-y-0.5 text-[10.5px] leading-relaxed text-text-secondary">
            <li>Best value per GB this week</li>
            <li>30-day validity, no rollover loss</li>
            <li>Why: beat 6 other bundles on cost-per-GB</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
