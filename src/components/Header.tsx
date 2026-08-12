"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ShoppingCart } from "lucide-react";
import { clsx } from "clsx";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StreakBadge } from "@/components/StreakBadge";

export function Header({ currentStreak = 0 }: { currentStreak?: number } = {}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUnreadCount(data?.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Mobile: plain flex row, justify-between — only two items ever render
          (logo, icon cluster), so this pins them to the two edges exactly.
          md+: switches to the 3-column grid so the centered nav gets its own
          track between them. A single grid-cols-[1fr_auto_1fr] at every
          breakpoint left the mobile icon cluster short of the right edge —
          the "auto" track still collapsed to 0 width, but the two 1fr tracks
          split what remained around it rather than starting from the edges,
          and the logo's non-shrinking min-content ate more than its fair
          half. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg-surface/90 px-4 backdrop-blur-md md:grid md:grid-cols-[1fr_auto_1fr] md:justify-normal md:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 justify-self-start"
          aria-label="Kuwana home"
        >
          <Image src="/kuwana-mark.png" alt="" width={32} height={32} className="rounded-full" />
          <span className="font-display text-[16px] font-bold text-accent-teal">kuwana.ai</span>
        </Link>

        {/* Desktop nav — segmented pill dock, dead-centred. Icons everywhere;
            labels from lg up (tablets get compact icon-only pills). The active
            section gets a tinted fill + inset ring so the current page pops. */}
        <nav aria-label="Primary" className="hidden justify-self-center md:block">
          <ul className="flex items-center gap-1 rounded-full border border-border bg-bg-surface-raised/80 p-1 shadow-[0_10px_30px_-18px_rgba(2,6,23,0.5)]">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    title={label}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex items-center gap-2 rounded-full px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 lg:px-4",
                      active
                        ? "bg-accent-sky/15 text-accent-sky shadow-[inset_0_0_0_1px_var(--accent-sky)]"
                        : "text-text-secondary hover:bg-bg-base hover:text-text-primary",
                    )}
                  >
                    <Icon size={15} strokeWidth={active ? 2.5 : 2.1} />
                    <span className="hidden lg:inline">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          {/* Streak badge sits directly left of the bell so the four
              chrome buttons (streak, notifications, shopping list, theme)
              form a single matched row. Hidden when there's no streak yet. */}
          <StreakBadge currentStreak={currentStreak} />
          <Link
            href="/notifications"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            className="tap-target relative flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-coral px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/profile/saved"
            aria-label="Shopping list"
            className="tap-target flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary"
          >
            <ShoppingCart size={18} />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      {/* Reserves the fixed header's height in normal flow at every breakpoint
          so content never renders underneath it. */}
      <div className="h-16" aria-hidden="true" />
    </>
  );
}
