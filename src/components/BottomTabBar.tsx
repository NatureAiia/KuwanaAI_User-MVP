"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Trophy, CircleUser } from "lucide-react";
import { clsx } from "clsx";

const TABS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/profile/quests", label: "Quests", icon: Trophy },
  { href: "/profile", label: "Profile", icon: CircleUser },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-surface/95 backdrop-blur-sm md:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname?.startsWith(href));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "tap-target flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-accent-gold" : "text-text-muted",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
