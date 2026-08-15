"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "open" | "in_progress" | "resolved" | "dismissed";
type Outcome = "none" | "warning" | "fine" | "suspension";

// Regulator counterpart to corporate/InvestigationRowActions — adds an
// enforcement outcome selector (only meaningful once a regulator closes a
// case) and an evidence URL, neither of which apply to a corporate
// self-flagged investigation.
export function InvestigationRowActions({
  id,
  status,
  notes,
  outcome,
  evidenceUrls,
}: {
  id: string;
  status: Status;
  notes: string | null;
  outcome: Outcome;
  evidenceUrls: string[];
}) {
  const router = useRouter();
  const [noteDraft, setNoteDraft] = useState(notes ?? "");
  const [evidenceDraft, setEvidenceDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [addingEvidence, setAddingEvidence] = useState(false);

  async function patch(body: { status?: Status; notes?: string; outcome?: Outcome; evidenceUrls?: string[] }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/regulator/investigations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
      setEditingNote(false);
      setAddingEvidence(false);
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

      <select
        value={outcome}
        disabled={loading}
        onChange={(e) => patch({ outcome: e.target.value as Outcome })}
        className="tap-target rounded-lg border border-border bg-bg-surface p-1.5 text-[12px] disabled:opacity-50"
      >
        <option value="none">No outcome yet</option>
        <option value="warning">Warning issued</option>
        <option value="fine">Fine issued</option>
        <option value="suspension">Provider suspended</option>
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

      {addingEvidence ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={evidenceDraft}
            onChange={(e) => setEvidenceDraft(e.target.value)}
            placeholder="Evidence URL"
            className="tap-target rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
          />
          <button
            onClick={() => {
              if (!evidenceDraft.trim()) return;
              patch({ evidenceUrls: [...evidenceUrls, evidenceDraft.trim()] });
              setEvidenceDraft("");
            }}
            disabled={loading}
            className="tap-target rounded-lg border border-border px-2 py-1.5 text-[11.5px] text-accent-sky"
          >
            Add
          </button>
        </div>
      ) : (
        <button onClick={() => setAddingEvidence(true)} className="text-[11.5px] text-text-muted hover:text-accent-sky">
          {evidenceUrls.length > 0 ? `Evidence (${evidenceUrls.length})` : "Attach evidence"}
        </button>
      )}
    </div>
  );
}
