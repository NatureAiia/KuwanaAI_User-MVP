"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Search, TrendingUp, ClipboardCheck, ShieldAlert, MessageSquareWarning, Wallet, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type NavLink = { href: string; label: string; icon: LucideIcon };

// Flat list, not grouped/collapsible like CorporatePortalNav — with only a
// few sections there's nothing to group and nothing worth collapsing yet.
const NAV_LINKS: NavLink[] = [
  { href: "/regulator", label: "Overview", icon: LineChart },
  { href: "/regulator/investigations", label: "Investigations", icon: Search },
  { href: "/regulator/price-index", label: "Price Index", icon: TrendingUp },
  { href: "/regulator/scorecard", label: "Scorecard", icon: ClipboardCheck },
  { href: "/regulator/alerts", label: "Price Caps", icon: ShieldAlert },
  { href: "/regulator/complaints", label: "Complaints", icon: MessageSquareWarning },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

function isActive(pathname: string, href: string) {
  return href === "/regulator" ? pathname === "/regulator" : pathname.startsWith(href);
}

/** Mobile: pill row. Desktop: a left sidebar — icon chip + label, active marked with a colored chip and a left accent bar. */
export function RegulatorPortalNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex flex-wrap items-center gap-2 px-5 py-3 md:hidden">
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "tap-target flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-medium",
                active ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary",
              )}
            >
              <Icon size={14} strokeWidth={2} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <nav className="hidden w-[220px] shrink-0 flex-col border-r border-border md:flex">
        <div className="flex flex-1 flex-col gap-0.5 px-3 py-5">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "group relative flex items-center gap-2.5 overflow-hidden rounded-lg py-2 pl-3 pr-3 text-[13px] transition-colors",
                  active
                    ? "font-semibold text-text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-accent-sky"
                    : "font-medium text-text-secondary hover:bg-bg-surface-raised",
                )}
              >
                <span
                  className={clsx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    active ? "bg-accent-sky/15 text-accent-sky" : "bg-transparent text-text-muted group-hover:bg-bg-surface",
                  )}
                >
                  <Icon size={15} strokeWidth={2} />
                </span>
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
