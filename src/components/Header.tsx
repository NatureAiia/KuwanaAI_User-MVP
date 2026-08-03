"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Moon, Sun } from "lucide-react";
import { clsx } from "clsx";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

export function Header() {
  const pathname = usePathname();
  // Default matches layout.tsx's hardcoded `className="dark"` and its
  // pre-hydration theme-init script, whose default is also dark — this must
  // stay in sync with that SSR default, or this button's aria-label/icon
  // will mismatch between server and client render and trigger a hydration
  // error (see layout.tsx's THEME_INIT_SCRIPT).
  const [isDark, setIsDark] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Reconciles with the actual class the pre-hydration script set from
    // localStorage — only differs from the SSR default when it's "light".
    const actual = document.documentElement.classList.contains("dark");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the DOM class an external script set before hydration, not deriving render output
    if (actual !== isDark) setIsDark(actual);
  }, [isDark]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUnreadCount(data?.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("kuwana-theme", next ? "dark" : "light");
  }

  return (
    <header className="flex items-center justify-between">
      <span className="font-display text-[16px] font-bold text-accent-primary">Kuwana</span>

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
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="tap-target flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
