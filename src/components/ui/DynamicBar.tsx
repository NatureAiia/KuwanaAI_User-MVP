"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";

const COLOR_CLASSES = {
  sky: "bg-accent-sky",
  teal: "bg-accent-teal",
  coral: "bg-accent-coral",
};

/**
 * A fill bar whose width is driven by a CSS custom property instead of an
 * inline `style` on every render — set once per value change, animates via
 * the `transition` on the property itself. Defaults to 0% until mounted,
 * so bars visibly fill in on load rather than snapping to their value.
 */
export function DynamicBar({
  value,
  color = "teal",
  className,
  trackClassName,
}: {
  value: number;
  color?: keyof typeof COLOR_CLASSES;
  className?: string;
  trackClassName?: string;
}) {
  const fillRef = useRef<HTMLDivElement | null>(null);
  const pct = Math.max(0, Math.min(100, value));

  useEffect(() => {
    fillRef.current?.style.setProperty("--dynamic-bar-fill", `${pct}%`);
  }, [pct]);

  return (
    <div
      className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-raised", trackClassName)}
    >
      <div
        ref={fillRef}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={clsx(
          "h-1.5 rounded-full transition-[width] duration-500 ease-out [width:var(--dynamic-bar-fill,0%)]",
          COLOR_CLASSES[color],
          className,
        )}
      />
    </div>
  );
}
