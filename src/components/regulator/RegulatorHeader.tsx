"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

// Same shape as CorporateHeader — a header built for this section rather
// than the shared consumer one — just carrying the regulator body's name
// (e.g. "POTRAZ") instead of a company name.
export function RegulatorHeader({ regulatorName }: { regulatorName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHub = pathname === "/regulator";
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUnreadCount(data?.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-surface px-5 py-3 md:px-8">
      <div className="flex items-center gap-2">
        {!isHub && (
          <button
            type="button"
            onClick={() => router.push("/regulator")}
            aria-label="Back to Compliance & Market Monitoring"
            className="tap-target -ml-1 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <Link href="/regulator" className="flex items-center gap-2.5">
          <Image src="/kuwana-mark.png" alt="" width={26} height={26} className="rounded-full" />
          <div className="leading-tight">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-sky">Kuwana for Regulators</p>
            <p className="font-display text-[14px] font-bold text-text-primary">{regulatorName}</p>
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/regulator/notifications"
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
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
