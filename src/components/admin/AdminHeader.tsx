"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isHub = pathname === "/admin";

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 md:px-10">
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
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/kuwana-mark.png" alt="" width={28} height={28} className="rounded-full" />
          <span className="font-display text-[15px] font-bold text-accent-teal">Admin</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
