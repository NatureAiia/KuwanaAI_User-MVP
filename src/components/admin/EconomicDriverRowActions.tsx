"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function EconomicDriverRowActions({ economicDriverId }: { economicDriverId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm("Delete this reading? This can't be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/economic-drivers/${economicDriverId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={loading}
      aria-label="Delete economic driver reading"
      className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
    >
      <Trash2 size={14} />
    </button>
  );
}
