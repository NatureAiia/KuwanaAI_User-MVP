"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ProviderOwnerLink({
  providerId,
  currentOwnerEmail,
}: {
  providerId: string;
  currentOwnerEmail: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(currentOwnerEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerEmail: email.trim() || null }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to link owner");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="tap-target flex items-center gap-1.5 text-[12.5px] text-text-secondary hover:text-accent-sky"
      >
        {currentOwnerEmail ?? <span className="italic text-text-muted">Unlinked</span>}
        <Pencil size={12} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="email"
          placeholder="owner@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-44 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
        />
        <Button size="md" onClick={save} disabled={loading} className="!px-2.5 !py-1.5 !text-[12px]">
          Save
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="!px-2 !py-1.5 !text-[12px]"
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-[11.5px] text-accent-coral">{error}</p>}
    </div>
  );
}
