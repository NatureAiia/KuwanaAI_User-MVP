"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";
import { ADMIN_LINKS } from "@/lib/adminNav";

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isHub = pathname === "/admin";
  const currentSection = ADMIN_LINKS.find(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`),
  );

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-bg-base px-5 py-3 md:px-10">
      <div className="flex items-center gap-2">
        {!isHub && (
          <button
            type="button"
            onClick={() => router.push("/admin")}
            aria-label="Back to admin"
            className="tap-target -ml-1 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <Link href="/admin" className="flex items-center gap-2 md:hidden">
          <Image src="/kuwana-mark.png" alt="" width={28} height={28} className="rounded-full" />
          <span className="font-display text-[15px] font-bold text-accent-teal">Admin</span>
        </Link>
        {/* Desktop-only breadcrumb — the sidebar already shows the brand, so this just orients the page within it. */}
        <div className="hidden items-center gap-1.5 text-[13px] md:flex">
          <Link href="/admin" className="text-text-muted hover:text-text-secondary">
            Admin
          </Link>
          {!isHub && (
            <>
              <span className="text-text-muted">/</span>
              <span className="font-medium text-text-primary">{currentSection?.label ?? "Section"}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
