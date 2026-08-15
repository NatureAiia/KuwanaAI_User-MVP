"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "open" | "reviewing" | "resolved" | "dismissed";

export function ComplaintRowActions({
  id,
  status,
  listingId,
  linkedInvestigationId,
}: {
  id: string;
  status: Status;
  listingId: string | null;
  linkedInvestigationId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function patch(body: { status?: Status; promote?: true }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/regulator/complaints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <select
        value={status}
        disabled={loading}
        onChange={(e) => patch({ status: e.target.value as Status })}
        className="tap-target rounded-lg border border-border bg-bg-surface p-1.5 text-[12px] disabled:opacity-50"
      >
        <option value="open">Open</option>
        <option value="reviewing">Reviewing</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>

      {linkedInvestigationId ? (
        <span className="text-[11.5px] text-accent-teal">Promoted to case</span>
      ) : listingId ? (
        <button
          onClick={() => patch({ promote: true })}
          disabled={loading}
          className="tap-target rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-medium text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral disabled:opacity-50"
        >
          Promote to case
        </button>
      ) : (
        <span className="text-[11px] text-text-muted">No listing to investigate</span>
      )}
    </div>
  );
}
