"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ListingRowActions({
  listingId,
  currentPrice,
  currentCurrency,
  currentSourceUrl,
}: {
  listingId: string;
  currentPrice: number;
  currentCurrency: string;
  currentSourceUrl: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(currentPrice));
  const [currency, setCurrency] = useState(currentCurrency);
  const [sourceUrl, setSourceUrl] = useState(currentSourceUrl ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: Number(price),
          currency,
          sourceUrl: sourceUrl || null,
        }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this listing? This can't be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/listings/${listingId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit listing"
          className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={remove}
          disabled={loading}
          aria-label="Delete listing"
          className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="number"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="w-20 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
      />
      <input
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="w-14 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
      />
      <input
        placeholder="Source URL"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        className="w-32 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
      />
      <Button size="md" onClick={save} disabled={loading} className="!px-2.5 !py-1.5 !text-[12px]">
        Save
      </Button>
      <Button variant="ghost" size="md" onClick={() => setEditing(false)} className="!px-2 !py-1.5 !text-[12px]">
        Cancel
      </Button>
    </div>
  );
}
