"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function ProviderListingActions({
  listingId,
  status,
  currentPrice,
  currentCurrency,
}: {
  listingId: string;
  status: "draft" | "pending_review" | "rejected";
  currentPrice: number;
  currentCurrency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(currentPrice));
  const [currency, setCurrency] = useState(currentCurrency);
  const [loading, setLoading] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/provider/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      const res = await fetch(`/api/provider/listings/${listingId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="tap-target w-20 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
        />
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="tap-target w-14 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
        />
        <Button
          size="md"
          onClick={() => patch({ price: Number(price), currency })}
          disabled={loading}
          className="!px-2.5 !py-1.5 !text-[12px]"
        >
          Save
        </Button>
        <Button variant="ghost" size="md" onClick={() => setEditing(false)} className="!px-2 !py-1.5 !text-[12px]">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="secondary" size="md" onClick={() => setEditing(true)} className="!px-2.5 !py-1.5 !text-[12px]">
        Edit
      </Button>
      {(status === "draft" || status === "rejected") && (
        <Button
          size="md"
          onClick={() => patch({ status: "pending_review" })}
          disabled={loading}
          className="!px-2.5 !py-1.5 !text-[12px]"
        >
          {status === "rejected" ? "Resubmit" : "Submit for review"}
        </Button>
      )}
      <Button
        variant="danger"
        size="md"
        onClick={remove}
        disabled={loading}
        className="!px-2.5 !py-1.5 !text-[12px]"
      >
        Delete
      </Button>
    </div>
  );
}
