"use client";

import { ChevronUp } from "lucide-react";

export function BackToTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="tap-target flex items-center gap-1.5 rounded-full border border-border bg-bg-surface px-4 py-2 text-[12px] font-medium text-text-secondary shadow-sm transition-colors hover:border-accent-sky/40 hover:text-accent-sky"
    >
      <ChevronUp size={14} className="animate-bounce-subtle" />
      Back to top
    </button>
  );
}
