import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

// Deliberately not the consumer Header: no StreakBadge, notification bell, or
// cart icon — none of that gamification applies to a corporate account. Same
// idea AdminHeader already uses ("a header built for this section, not the
// shared consumer one"), just carrying the business's own name instead of
// "Admin".
export function CorporateHeader({ companyName }: { companyName: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 md:px-8">
      <Link href="/corporate" className="flex items-center gap-2.5">
        <Image src="/kuwana-mark.png" alt="" width={26} height={26} className="rounded-full" />
        <div className="leading-tight">
          <p className="text-[10.5px] uppercase tracking-wide text-text-muted">Kuwana for Business</p>
          <p className="font-display text-[14px] font-bold">{companyName}</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
