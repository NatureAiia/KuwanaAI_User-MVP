"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Package, ClipboardList, Building2, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/corporate", label: "Market Intelligence", icon: LineChart },
  { href: "/corporate/products", label: "My Products", icon: Package },
  { href: "/corporate/requests", label: "Requests", icon: ClipboardList },
  { href: "/corporate/profile", label: "Company Profile", icon: Building2 },
];

// Resolves the active section from the URL itself (usePathname) rather than
// a prop every page had to pass — the whole point of moving this into
// corporate/layout.tsx is that no page needs to know its own route just to
// render the nav.
function isActive(pathname: string, href: string) {
  return href === "/corporate" ? pathname === "/corporate" : pathname.startsWith(href);
}

/** Mobile: today's pill row, unchanged. Desktop: a left sidebar — icon + label, active marked with a left accent bar instead of a rounded pill. */
export function CorporatePortalNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex flex-wrap gap-2 px-5 py-3 md:hidden">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "tap-target rounded-full border px-4 py-2 text-[13px] font-medium",
                active ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <nav className="hidden w-[220px] shrink-0 flex-col gap-0.5 border-r border-border px-3 py-5 md:flex">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2.5 text-[13px] font-medium",
                active
                  ? "border-accent-sky bg-accent-sky/10 text-accent-sky"
                  : "border-transparent text-text-secondary hover:bg-bg-surface-raised",
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
