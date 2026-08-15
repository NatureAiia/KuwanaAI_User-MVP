"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export type PortalNavLink = { href: string; label: string; icon: LucideIcon };
export type PortalNavGroup = { label?: string; links: PortalNavLink[] };

/**
 * Fixed bottom nav for the corporate/regulator portals — the same shape as
 * the consumer app's BottomTabBar (fixed bar, icon+label tabs), except these
 * portals have too many sections (6-18) to fit as tabs, so only the first
 * few surface directly and the rest live behind a "Menu" tab that opens a
 * full-screen sheet grouped the same way the desktop sidebar is. Replaces
 * the old top-of-page pill row on mobile (still used as the section switcher
 * on desktop's non-nav pages, e.g. regulator's sector filter).
 */
export function PortalMobileNav({ groups, quickLinkCount = 4 }: { groups: PortalNavGroup[]; quickLinkCount?: number }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const allLinks = groups.flatMap((g) => g.links);
  const quickLinks = allLinks.slice(0, quickLinkCount);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-surface/95 backdrop-blur-sm md:hidden"
      >
        <ul className="flex items-stretch justify-around">
          {quickLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
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
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="tap-target flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-text-muted"
            >
              <span className="flex items-center justify-center rounded-full px-3.5 py-1">
                <Menu size={22} strokeWidth={2} />
              </span>
              Menu
            </button>
          </li>
        </ul>
      </nav>

      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm md:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[75vh] overflow-y-auto rounded-t-[24px] border-t border-border bg-bg-surface p-4 pb-8"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display text-[15px] font-semibold">Menu</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-raised"
              >
                <X size={16} />
              </button>
            </div>

            {groups.map((group, groupIndex) => (
              <div key={group.label ?? groupIndex} className={clsx(groupIndex > 0 && "mt-3")}>
                {group.label && (
                  <p className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-text-muted">
                    {group.label}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  {group.links.map((link) => {
                    const active = isActive(link.href);
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className={clsx(
                          "flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-[13.5px]",
                          active ? "font-semibold text-accent-sky" : "font-medium text-text-secondary",
                        )}
                      >
                        <span
                          className={clsx(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            active ? "bg-accent-sky/15 text-accent-sky" : "bg-bg-surface-raised text-text-muted",
                          )}
                        >
                          <Icon size={16} strokeWidth={2} />
                        </span>
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
