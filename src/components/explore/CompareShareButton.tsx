"use client";

import { Share2 } from "lucide-react";
import { downloadComparePdf, type CompareShareData } from "@/lib/comparePdf";

/**
 * Share icon on the compare page header row. Generates a PDF of the compared
 * AI recommendation + traditional (Python) comparison client-side and saves
 * it, so the user can share the comparison with someone else.
 */
export function CompareShareButton({ data }: { data: CompareShareData }) {
  return (
    <button
      type="button"
      onClick={() => downloadComparePdf(data)}
      aria-label="Share this comparison as a PDF"
      title="Download this comparison as a PDF (table + AI recommendation + traditional comparison)"
      className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary transition-colors hover:border-accent-sky/50 hover:text-accent-sky"
    >
      <Share2 size={18} />
    </button>
  );
}
