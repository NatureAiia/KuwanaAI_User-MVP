import Link from "next/link";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

type EmptyStateAction = { label: string; href: string } | { label: string; onClick: () => void };

/**
 * The dead-end "No X yet." idiom, replaced with something that answers the
 * user's next question: what happened, why, and what to do about it. Not
 * every empty state needs an action — omit it when there's genuinely no
 * next step (e.g. "No reviews yet" on a listing nobody else has reviewed).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  variant?: "card" | "inline";
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "text-center",
        variant === "card" && "rounded-[var(--radius-card)] border border-border bg-bg-surface p-6",
        className,
      )}
    >
      {Icon && <Icon size={28} className="mx-auto mb-2 text-text-muted" />}
      <p className="text-[14px] text-text-secondary">{title}</p>
      {description && <p className="mt-1 text-[13px] text-text-muted">{description}</p>}
      {action &&
        ("href" in action ? (
          <Link
            href={action.href}
            className="tap-target mt-4 inline-flex items-center rounded-full bg-accent-sky px-5 py-2 text-[13px] font-semibold text-white"
          >
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="tap-target mt-4 inline-flex items-center rounded-full bg-accent-sky px-5 py-2 text-[13px] font-semibold text-white"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
