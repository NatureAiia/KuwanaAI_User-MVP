import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * The bordered-card-with-border-t-divided-rows list shape used across every
 * corporate page with a data list (products, fee comparison, competitor
 * watch, live feed, forecasts) — pulled out once it had been hand-copied
 * (outer rounded/border wrapper + `i > 0 ? "border-t" : ""` per row) into
 * four separate files.
 */
export function DividedList<T>({
  items,
  keyFor,
  renderItem,
  itemClassName,
  emptyMessage,
  className,
}: {
  items: T[];
  keyFor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  itemClassName?: string;
  emptyMessage?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("overflow-hidden rounded-[var(--radius-card)] border border-border", className)}>
      {items.map((item, i) => (
        <div
          key={keyFor(item, i)}
          className={clsx("bg-bg-surface p-3.5", i > 0 && "border-t border-border", itemClassName)}
        >
          {renderItem(item, i)}
        </div>
      ))}
      {items.length === 0 && emptyMessage && (
        <div className="bg-bg-surface p-6 text-center text-[13px] text-text-muted">{emptyMessage}</div>
      )}
    </div>
  );
}
