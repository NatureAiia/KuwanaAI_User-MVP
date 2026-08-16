import { clsx } from "clsx";

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function formatDateLabel(date: Date) {
  const now = new Date();
  if (isSameDay(date, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * `stickyTop`, when passed, pins the divider to that offset (in px from the
 * viewport top, below the sticky chat header) instead of scrolling with its
 * message group — WhatsApp-style. Consecutive day-groups' dividers all stick
 * at the same offset, so plain CSS sticky handles swapping to the next day
 * as the user scrolls past a boundary; no scroll-position tracking needed.
 */
export function DateDivider({ date, stickyTop }: { date: Date; stickyTop?: number }) {
  return (
    <div
      className={clsx("flex items-center justify-center py-1", stickyTop !== undefined && "sticky z-20")}
      style={stickyTop !== undefined ? { top: stickyTop } : undefined}
    >
      <span className="rounded-full bg-bg-surface-raised px-3 py-1 text-[10.5px] font-medium text-text-muted shadow-sm">
        {formatDateLabel(date)}
      </span>
    </div>
  );
}
