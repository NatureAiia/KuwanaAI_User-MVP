"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { clsx } from "clsx";

/**
 * Wraps content in a bordered card that lights up around the cursor on
 * hover — a teal radial glow tracking pointer position within the card.
 */
export function GlowBorder({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !ref.current) return;
    ref.current.style.setProperty("--x", `${event.clientX - rect.left}px`);
    ref.current.style.setProperty("--y", `${event.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={clsx(
        "group relative overflow-hidden rounded-[var(--radius-card)] border border-border",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(140px circle at var(--x, 50%) var(--y, 50%), color-mix(in srgb, var(--accent-teal) 20%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
