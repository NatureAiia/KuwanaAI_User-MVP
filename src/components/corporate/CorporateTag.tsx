import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

// An enterprise-chip counterpart to ui/Card.tsx's Badge — same tone formula
// (15%-tint background / full-color text / 30%-tint border, already
// accessibility-tested at those exact opacities, see globals.css) but
// rounded-md instead of rounded-full and denser padding, so status labels in
// the corporate section read as a data-dense dashboard tag rather than a
// gamified pill. Badge itself is left untouched — it's shared with the
// consumer/admin sections and has its own accessibility test keyed to it.
export function CorporateTag({
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
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        toneClasses,
        className,
      )}
      {...props}
    />
  );
}
