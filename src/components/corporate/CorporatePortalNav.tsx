"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Package, ClipboardList, Building2, Wallet, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const COLLAPSE_KEY = "corporate-nav-collapsed";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/corporate", label: "Market Intelligence", icon: LineChart },
  { href: "/corporate/products", label: "My Products", icon: Package },
  { href: "/corporate/requests", label: "Requests", icon: ClipboardList },
  { href: "/corporate/profile", label: "Company Profile", icon: Building2 },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

// Resolves the active section from the URL itself (usePathname) rather than
// a prop every page had to pass — the whole point of moving this into
// corporate/layout.tsx is that no page needs to know its own route just to
// render the nav.
function isActive(pathname: string, href: string) {
  return href === "/corporate" ? pathname === "/corporate" : pathname.startsWith(href);
}

/** Mobile: pill row with icons. Desktop: a left sidebar — icon chip + label, active marked with a colored chip and a left accent bar, plus a company identity card pinned to the bottom. Collapsible to an icon-only rail; the choice is remembered per-browser via localStorage. */
export function CorporatePortalNav({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const initial = companyName.trim().charAt(0).toUpperCase() || "K";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a one-time user preference from localStorage, not deriving render output
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      <nav className="flex flex-wrap gap-2 px-5 py-3 md:hidden">
        {LINKS.map((link) => {
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

      <nav
        className={clsx(
          "hidden shrink-0 flex-col border-r border-border md:flex",
          collapsed ? "w-[64px]" : "w-[240px]",
        )}
      >
        <div className={clsx("flex flex-1 flex-col gap-0.5 py-5", collapsed ? "items-center px-2" : "px-3")}>
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={clsx(
                  "group relative flex items-center gap-2.5 overflow-hidden rounded-lg py-2 text-[13px] transition-colors",
                  collapsed ? "justify-center px-0" : "pl-3 pr-3",
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
                {!collapsed && link.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={clsx(
              "tap-target mt-2 flex items-center gap-2.5 rounded-lg py-2 text-[12.5px] font-medium text-text-muted hover:bg-bg-surface-raised hover:text-text-secondary",
              collapsed ? "justify-center px-0" : "pl-3 pr-3",
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              {collapsed ? <ChevronsRight size={15} strokeWidth={2} /> : <ChevronsLeft size={15} strokeWidth={2} />}
            </span>
            {!collapsed && "Collapse"}
          </button>
        </div>

        <div className={clsx("border-t border-border", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <div
              title={companyName}
              className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent-sky/15 font-display text-[13px] font-bold text-accent-sky"
            >
              {initial}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg bg-bg-surface-raised px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-sky/15 font-display text-[13px] font-bold text-accent-sky">
                {initial}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[12.5px] font-semibold text-text-primary">{companyName}</p>
                <p className="text-[10.5px] text-text-muted">Business account</p>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
