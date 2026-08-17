"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";
import { clsx } from "clsx";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

const QUEST_FAB_POSITION_KEY = "kuwana:quest-fab-position";
const QUEST_FAB_SIZE = 56;
const DRAG_THRESHOLD = 4;
// A quick click/tap must still navigate normally — dragging only engages
// after the pointer has been held this long, same gesture as a real
// press-and-hold-to-drag interaction on both desktop and mobile.
const HOLD_TO_DRAG_MS = 200;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function BottomTabBar() {
  const pathname = usePathname();
  const questsActive = isNavItemActive(pathname, "/profile/quests");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef({
    armed: false,
    moved: false,
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
    lastX: 0,
    lastY: 0,
    holdTimer: null as ReturnType<typeof setTimeout> | null,
  });

  useEffect(() => {
    const saved = localStorage.getItem(QUEST_FAB_POSITION_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { x: number; y: number };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time saved position from localStorage, not deriving render output
      setPos({
        x: clamp(parsed.x, 4, window.innerWidth - QUEST_FAB_SIZE - 4),
        y: clamp(parsed.y, 4, window.innerHeight - QUEST_FAB_SIZE - 4),
      });
    } catch {
      // ignore malformed saved position
    }
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (dragState.current.holdTimer) clearTimeout(dragState.current.holdTimer);
    dragState.current = {
      armed: false,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      posX: rect.left,
      posY: rect.top,
      lastX: e.clientX,
      lastY: e.clientY,
      // Click-and-hold on desktop, touch-and-hold on mobile: both arrive as
      // pointer events, so one timer covers both — only after it fires does
      // movement start repositioning the button. The drag origin resets to
      // the pointer's live position at arm-time (not its position at
      // pointerdown), so movement during the hold window doesn't get
      // applied as one jump the instant dragging arms.
      holdTimer: setTimeout(() => {
        dragState.current.armed = true;
        dragState.current.startX = dragState.current.lastX;
        dragState.current.startY = dragState.current.lastY;
      }, HOLD_TO_DRAG_MS),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;
    if (!dragState.current.armed) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragState.current.moved = true;
    if (!dragState.current.moved) return;
    setPos({
      x: clamp(dragState.current.posX + dx, 4, window.innerWidth - QUEST_FAB_SIZE - 4),
      y: clamp(dragState.current.posY + dy, 4, window.innerHeight - QUEST_FAB_SIZE - 4),
    });
  }

  function handlePointerEnd() {
    if (dragState.current.holdTimer) clearTimeout(dragState.current.holdTimer);
    dragState.current.holdTimer = null;
    dragState.current.armed = false;
    if (dragState.current.moved) {
      setPos((current) => {
        if (current) localStorage.setItem(QUEST_FAB_POSITION_KEY, JSON.stringify(current));
        return current;
      });
    }
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (dragState.current.moved) e.preventDefault();
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-surface/95 backdrop-blur-sm md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "tap-target flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                    active ? "text-accent-sky" : "text-text-muted",
                  )}
                >
                  <span
                    className={clsx(
                      "flex items-center justify-center rounded-full px-3.5 py-1 transition-colors",
                      active && "bg-accent-sky/15",
                    )}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quests moved out of the primary nav (see nav.ts) to make room for
          Shorts — reached here instead as a floating action button. Defaults
          above the tab bar on mobile (bottom-20, clear of its ~64px height)
          and to a plain bottom-right corner on desktop. Press-and-hold then
          drag to reposition (mouse or touch, via Pointer Events) — a plain
          click/tap still navigates to Quests. The chosen spot is remembered
          in localStorage across visits. */}
      <Link
        href="/profile/quests"
        aria-label="Quests"
        aria-current={questsActive ? "page" : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={handleClick}
        style={pos ? { left: pos.x, top: pos.y } : undefined}
        className={clsx(
          "tap-target fixed z-40 flex h-14 w-14 touch-none items-center justify-center rounded-full border border-border shadow-[0_10px_30px_-12px_rgba(2,6,23,0.55)] backdrop-blur-sm transition-colors",
          !pos && "bottom-20 right-4 md:bottom-6 md:right-6",
          questsActive ? "bg-accent-sky text-white" : "bg-bg-surface/95 text-accent-sky",
        )}
      >
        <Trophy size={24} strokeWidth={questsActive ? 2.5 : 2} />
      </Link>
    </>
  );
}
