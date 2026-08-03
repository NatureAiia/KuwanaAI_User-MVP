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

export function DateDivider({ date }: { date: Date }) {
  return (
    <div className="flex items-center justify-center py-1">
      <span className="rounded-full bg-bg-surface-raised px-3 py-1 text-[10.5px] font-medium text-text-muted">
        {formatDateLabel(date)}
      </span>
    </div>
  );
}
