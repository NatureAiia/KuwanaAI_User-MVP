"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function AdvertRowActions({ advertId, active }: { advertId: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirmDialog();

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/adverts/${advertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!(await confirm.ask({ title: "Delete this advert?", description: "This can't be undone.", danger: true })))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/adverts/${advertId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <div className="flex flex-wrap gap-1.5">
      <button
        onClick={toggle}
        disabled={loading}
        className={`tap-target rounded-lg border px-2.5 py-1.5 text-[12px] font-medium ${
          active
            ? "border-accent-teal/50 text-accent-teal hover:bg-accent-teal/10"
            : "border-border text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
        }`}
      >
        {active ? "Active" : "Paused"}
      </button>
      <button
        onClick={remove}
        disabled={loading}
        aria-label="Delete advert"
        className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
      >
        <Trash2 size={14} />
      </button>
      </div>
    </>
  );
}
