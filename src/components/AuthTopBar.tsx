"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AuthTopBar() {
  return (
    <div className="fixed right-5 top-4 z-40 flex items-center gap-2 md:right-10">
      <ThemeToggle />
      <Link
        href="/"
        aria-label="Close and return to home"
        className="tap-target flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary hover:text-accent-sky"
      >
        <X size={18} />
      </Link>
    </div>
  );
}
