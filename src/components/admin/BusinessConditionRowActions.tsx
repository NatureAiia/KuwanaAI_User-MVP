"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCheck, UserMinus } from "lucide-react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

type RiskLevel = "low" | "medium" | "high";

export function BusinessConditionRowActions({
  id,
  riskLevel,
  assignedToCurrentAdmin,
}: {
  id: string;
  riskLevel: RiskLevel;
  // Whether the condition is currently assigned to the admin viewing this row
  // — the only assignment state this row can toggle without a full admin
  // picker (no "list all admins" endpoint exists anywhere in this app yet).
  assignedToCurrentAdmin: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirmDialog();

  async function setRisk(next: RiskLevel) {
    if (next === riskLevel) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business-conditions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskLevel: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function toggleAssignment() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business-conditions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignToSelf: !assignedToCurrentAdmin }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (
      !(await confirm.ask({
        title: "Stop tracking this condition?",
        description: "This can't be undone.",
        danger: true,
      }))
    )
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/business-conditions/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <div className="flex items-center gap-1.5">
      <select
        value={riskLevel}
        disabled={loading}
        onChange={(e) => setRisk(e.target.value as RiskLevel)}
        className="tap-target rounded-lg border border-border bg-bg-surface p-1.5 text-[12px] disabled:opacity-50"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button
        onClick={toggleAssignment}
        disabled={loading}
        aria-label={assignedToCurrentAdmin ? "Unassign from me" : "Assign to me — get review-due notifications"}
        title={assignedToCurrentAdmin ? "Unassign from me" : "Assign to me"}
        className={`tap-target rounded-lg border p-1.5 disabled:opacity-50 ${
          assignedToCurrentAdmin
            ? "border-accent-teal/50 text-accent-teal"
            : "border-border text-text-secondary hover:border-accent-teal/50 hover:text-accent-teal"
        }`}
      >
        {assignedToCurrentAdmin ? <UserMinus size={14} /> : <UserCheck size={14} />}
      </button>
      <button
        onClick={remove}
        disabled={loading}
        aria-label="Stop tracking condition"
        className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
      >
        <Trash2 size={14} />
      </button>
      </div>
    </>
  );
}
