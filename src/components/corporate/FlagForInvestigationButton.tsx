"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";

export function FlagForInvestigationButton({ listingId, reason }: { listingId: string; reason: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [flagged, setFlagged] = useState(false);

  async function flag() {
    setLoading(true);
    try {
      const res = await fetch("/api/corporate/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, reason }),
      });
      if (res.ok) {
        setFlagged(true);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (flagged) {
    return <span className="text-[11.5px] font-medium text-accent-teal">Flagged</span>;
  }

  return (
    <button
      onClick={flag}
      disabled={loading}
      className="tap-target flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral disabled:opacity-50"
    >
      <Flag size={12} />
      {loading ? "Flagging…" : "Flag for investigation"}
    </button>
  );
}
