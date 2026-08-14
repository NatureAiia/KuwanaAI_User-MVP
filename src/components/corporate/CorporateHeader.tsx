"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

// Deliberately not the consumer Header: no StreakBadge, notification bell, or
// cart icon — none of that gamification applies to a corporate account. Same
// idea AdminHeader already uses ("a header built for this section, not the
// shared consumer one"), just carrying the business's own name instead of
// "Admin".
export function CorporateHeader({ companyName }: { companyName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHub = pathname === "/corporate";

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-surface px-5 py-3 md:px-8">
      <div className="flex items-center gap-2">
        {!isHub && (
          <button
            type="button"
            onClick={() => router.push("/corporate")}
            aria-label="Back to Market Intelligence"
            className="tap-target -ml-1 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <Link href="/corporate" className="flex items-center gap-2.5">
          <Image src="/kuwana-mark.png" alt="" width={26} height={26} className="rounded-full" />
          <div className="leading-tight">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-sky">Kuwana for Business</p>
            <p className="font-display text-[14px] font-bold text-text-primary">{companyName}</p>
          </div>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
