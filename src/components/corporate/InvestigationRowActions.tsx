"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "open" | "in_progress" | "resolved" | "dismissed";

export function InvestigationRowActions({ id, status, notes }: { id: string; status: Status; notes: string | null }) {
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState(notes ?? "");
  const [loading, setLoading] = useState(false);
  const [editingNote, setEditingNote] = useState(false);

  async function patch(body: { status?: Status; notes?: string }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/corporate/investigations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
      setEditingNote(false);
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
        <option value="in_progress">In progress</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>
      {editingNote ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Add a note"
            className="tap-target rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
          />
          <button
            onClick={() => patch({ notes: noteDraft })}
            disabled={loading}
            className="tap-target rounded-lg border border-border px-2 py-1.5 text-[11.5px] text-accent-sky"
          >
            Save
          </button>
        </div>
      ) : (
        <button onClick={() => setEditingNote(true)} className="text-[11.5px] text-text-muted hover:text-accent-sky">
          {notes ? "Edit note" : "Add note"}
        </button>
      )}
    </div>
  );
}
