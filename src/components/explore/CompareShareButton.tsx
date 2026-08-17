"use client";

import { Share2 } from "lucide-react";
import type { CompareShareData } from "@/lib/comparePdf";

/**
 * Share icon on the compare page header row. Generates a PDF of the compared
 * AI recommendation + traditional comparison client-side and saves it, so the
 * user can share the comparison with someone else.
 *
 * comparePdf is imported at click time, not at module scope: it pulls in jspdf
 * and jspdf-autotable, which every visitor to the compare page was downloading
 * whether or not they ever pressed this button. The type import above is
 * erased at build time and costs nothing.
 */
export function CompareShareButton({ data }: { data: CompareShareData }) {
  const handleClick = async () => {
    const { downloadComparePdf } = await import("@/lib/comparePdf");
    downloadComparePdf(data);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Share this comparison as a PDF"
      title="Download this comparison as a PDF (table + AI recommendation + traditional comparison)"
      className="tap-target flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary transition-colors hover:border-accent-sky/50 hover:text-accent-sky"
    >
      <Share2 size={18} />
    </button>
  );
}
