"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Decision = "approved" | "rejected" | "flagged";

/** Regulator's approve/reject/flag actions on one pending new_field proposal — see /api/regulator/field-proposals/[id]. */
export function FieldProposalRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [noting, setNoting] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(decision: Decision) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/regulator/field-proposals/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? String(data.error) : "Failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
      setNoting(null);
    }
  }

  if (noting) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
        />
        {error && <p className="text-[11px] text-accent-coral">{error}</p>}
        <div className="flex gap-1.5">
          <Button size="md" onClick={() => submit(noting)} disabled={loading}>
            Confirm {noting}
          </Button>
          <Button variant="ghost" size="md" onClick={() => setNoting(null)} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <Button size="md" onClick={() => setNoting("approved")} disabled={loading} className="!bg-accent-teal">
        Approve
      </Button>
      <Button variant="secondary" size="md" onClick={() => setNoting("flagged")} disabled={loading}>
        Flag
      </Button>
      <Button variant="danger" size="md" onClick={() => setNoting("rejected")} disabled={loading}>
        Reject
      </Button>
    </div>
  );
}
