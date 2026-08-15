"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy } from "lucide-react";
import { clsx } from "clsx";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";

export function BottomTabBar() {
  const pathname = usePathname();
  const questsActive = isNavItemActive(pathname, "/profile/quests");

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-surface/95 backdrop-blur-sm md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "tap-target flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                    active ? "text-accent-sky" : "text-text-muted",
                  )}
                >
                  <span
                    className={clsx(
                      "flex items-center justify-center rounded-full px-3.5 py-1 transition-colors",
                      active && "bg-accent-sky/15",
                    )}
                  >
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Quests moved out of the primary nav (see nav.ts) to make room for
          Shorts — reached here instead as a floating action button. Sits
          above the tab bar on mobile (bottom-20, clear of its ~64px height)
          and drops to a plain bottom-right corner on desktop, where there's
          no tab bar to clear. */}
      <Link
        href="/profile/quests"
        aria-label="Quests"
        aria-current={questsActive ? "page" : undefined}
        className={clsx(
          "tap-target fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-border shadow-[0_10px_30px_-12px_rgba(2,6,23,0.55)] backdrop-blur-sm transition-colors md:bottom-6 md:right-6",
          questsActive ? "bg-accent-sky text-white" : "bg-bg-surface/95 text-accent-sky",
        )}
      >
        <Trophy size={24} strokeWidth={questsActive ? 2.5 : 2} />
      </Link>
    </>
  );
}
