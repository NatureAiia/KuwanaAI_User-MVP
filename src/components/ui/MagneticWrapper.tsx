// Magnetic Wrapper — magnetic-to-mouse pull applied to whatever it wraps.
// Use it to layer the magnetic motion onto any CTA (e.g. a WaterButton) on
// desktop. Desktop-only by nature: the pull reacts to a mouse. On touch the
// wrapper is inert and children render normally.
"use client";

import { useEffect, useRef, type ReactNode } from "react";

const RANGE_PER_POINT = 18;
const MAX_PULL = 0.5;

export function MagneticWrapper({
  children,
  magnet = 30,
  className,
}: {
  children: ReactNode;
  /** 0–100 — how far the wrapped element is allowed to chase the cursor. */
  magnet?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const pointer = { x: 0, y: 0 };
    const limits = { x: 0, y: 0 };
    let raf = 0;
    let alive = true;

    const dampen = (p: number, m: number) => {
      const easing = 0.001;
      const scale = 1 - Math.pow(1 - easing, m);
      const t = RANGE_PER_POINT * (MAX_PULL * scale + 0.5 * (1 - scale));
      return p * (t / RANGE_PER_POINT);
    };
    const update = () => {
      if (!alive) return;
      root.style.translate = `${dampen(pointer.x, limits.x)}px ${dampen(pointer.y, limits.y)}px`;
      raf = requestAnimationFrame(update);
    };
    const onEnter = () => {
      limits.x = magnet;
      limits.y = magnet;
    };
    const onLeave = () => {
      limits.x = 0;
      limits.y = 0;
    };
    const onMove = (e: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mousemove", onMove);
    root.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(update);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("mouseleave", onLeave);
    };
  }, [magnet]);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
