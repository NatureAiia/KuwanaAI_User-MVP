"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function AlertRuleRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirmDialog();

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/corporate/alert-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!(await confirm.ask({ title: "Delete this alert?", description: "This can't be undone.", danger: true })))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/corporate/alert-rules/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <div className="flex items-center gap-1.5">
      <button
        onClick={toggle}
        disabled={loading}
        className={`tap-target rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${
          enabled
            ? "border-accent-teal/50 text-accent-teal hover:bg-accent-teal/10"
            : "border-border text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
        }`}
      >
        {enabled ? "Enabled" : "Paused"}
      </button>
      <button
        onClick={remove}
        disabled={loading}
        aria-label="Delete alert"
        className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
      >
        <Trash2 size={14} />
      </button>
      </div>
    </>
  );
}
