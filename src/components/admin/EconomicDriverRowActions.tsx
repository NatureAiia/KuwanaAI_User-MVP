"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function EconomicDriverRowActions({ economicDriverId }: { economicDriverId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirmDialog();

  async function remove() {
    if (!(await confirm.ask({ title: "Delete this reading?", description: "This can't be undone.", danger: true })))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/economic-drivers/${economicDriverId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <button
        onClick={remove}
        disabled={loading}
        aria-label="Delete economic driver reading"
        className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
      >
        <Trash2 size={14} />
      </button>
    </>
  );
}
