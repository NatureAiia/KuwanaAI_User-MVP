import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "bg-bg-surface border border-border rounded-[var(--radius-card)] p-4",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "sky" | "teal" | "coral" }) {
  const toneClasses = {
    neutral: "bg-bg-surface-raised text-text-secondary border-border",
    sky: "bg-accent-sky/15 text-accent-sky border-accent-sky/30",
    teal: "bg-accent-teal/15 text-accent-teal border-accent-teal/30",
    coral: "bg-accent-coral/15 text-accent-coral border-accent-coral/30",
  }[tone];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        toneClasses,
        className,
      )}
      {...props}
    />
  );
}
