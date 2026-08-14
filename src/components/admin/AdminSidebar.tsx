"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ChevronsLeft, ChevronsRight } from "lucide-react";
import { clsx } from "clsx";
import { ADMIN_LINKS } from "@/lib/adminNav";

const COLLAPSE_KEY = "admin-nav-collapsed";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop-only left rail (mobile keeps the hub page's "Manage" grid plus the
 * header's back button — see AdminHeader). Mirrors CorporatePortalNav's
 * chip + left-accent-bar active state, and its collapse-to-icon-rail
 * behavior, so the two admin-ish surfaces feel like one system.
 */
export function AdminSidebar({
  username,
  pendingCounts,
}: {
  username: string;
  pendingCounts: Record<string, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const initial = username.trim().charAt(0).toUpperCase() || "A";

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
    <nav
      className={clsx(
        "hidden shrink-0 flex-col border-r border-border md:sticky md:top-0 md:flex md:h-screen md:self-start",
        collapsed ? "w-[64px]" : "w-[248px]",
      )}
    >
      <Link href="/admin" className={clsx("flex items-center gap-2 py-4", collapsed ? "justify-center px-0" : "px-5")}>
        <Image src="/kuwana-mark.png" alt="" width={26} height={26} className="rounded-full" />
        {!collapsed && <span className="font-display text-[15px] font-bold text-accent-teal">Admin</span>}
      </Link>

      <div className={clsx("flex flex-1 flex-col gap-0.5 overflow-y-auto pb-4", collapsed ? "items-center px-2" : "px-3")}>
        <Link
          href="/admin"
          title={collapsed ? "Overview" : undefined}
          className={clsx(
            "group relative flex items-center gap-2.5 overflow-hidden rounded-lg py-2 text-[13px] transition-colors",
            collapsed ? "justify-center px-0" : "pl-3 pr-3",
            pathname === "/admin"
              ? "font-semibold text-text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-accent-sky"
              : "font-medium text-text-secondary hover:bg-bg-surface-raised",
          )}
        >
          <span
            className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              pathname === "/admin" ? "bg-accent-sky/15 text-accent-sky" : "bg-transparent text-text-muted group-hover:bg-bg-surface",
            )}
          >
            <LayoutDashboard size={15} strokeWidth={2} />
          </span>
          {!collapsed && "Overview"}
        </Link>

        {!collapsed && <p className="mt-4 px-3 text-[11px] font-medium uppercase tracking-wide text-text-muted">Manage</p>}
        <div className={clsx("flex flex-col gap-0.5", collapsed ? "mt-2" : "mt-1")}>
          {ADMIN_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            const pending = pendingCounts[link.href] ?? 0;
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
                    "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                    active ? "bg-accent-sky/15 text-accent-sky" : "bg-transparent text-text-muted group-hover:bg-bg-surface",
                  )}
                >
                  <Icon size={15} strokeWidth={2} />
                  {collapsed && pending > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent-sky" />
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{link.label}</span>
                    {pending > 0 && (
                      <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-sky/15 px-1 font-mono text-[10.5px] font-semibold text-accent-sky">
                        {pending}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>

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
            title={username}
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
              <p className="truncate text-[12.5px] font-semibold text-text-primary">{username}</p>
              <p className="text-[10.5px] text-text-muted">Admin</p>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
