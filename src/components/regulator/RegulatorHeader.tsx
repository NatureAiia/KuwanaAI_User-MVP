"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

// Same shape as CorporateHeader — a header built for this section rather
// than the shared consumer one — just carrying the regulator body's name
// (e.g. "POTRAZ") instead of a company name. No notifications bell yet:
// there's no regulator-facing notifications page to link to (the generic
// /notifications page only surfaces listing-tied types, which a regulator
// account never gets) — add one back when that page exists.
export function RegulatorHeader({ regulatorName }: { regulatorName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHub = pathname === "/regulator";

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
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
