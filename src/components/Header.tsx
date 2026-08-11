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
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-bg-surface/95 px-5 backdrop-blur-sm md:static md:h-auto md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/kuwana-mark.png" alt="" width={32} height={32} className="rounded-full" />
          <span className="font-display text-[16px] font-bold text-accent-teal">kuwana.ai</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isNavItemActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "text-[13px] font-medium",
                  active ? "text-accent-sky" : "text-text-secondary hover:text-text-primary",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
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
      {/* Reserves the fixed header's height in normal flow so mobile content doesn't render underneath it. */}
      <div className="h-16 md:hidden" aria-hidden="true" />
    </>
  );
}
