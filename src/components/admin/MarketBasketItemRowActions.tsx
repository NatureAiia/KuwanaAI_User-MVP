"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function MarketBasketItemRowActions({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!confirm("Remove this component from its basket? This can't be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/market-basket-items/${itemId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={loading}
      aria-label="Remove basket component"
      className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
    >
      <Trash2 size={14} />
    </button>
  );
}
