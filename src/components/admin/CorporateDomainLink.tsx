"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CorporateDomainLink({
  providerId,
  currentDomain,
}: {
  providerId: string;
  currentDomain: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [domain, setDomain] = useState(currentDomain ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corporateDomain: domain.trim() || null }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to link domain");
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
        {currentDomain ?? <span className="italic text-text-muted">Unlinked</span>}
        <Pencil size={12} />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          placeholder="cbz.co.zw"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="tap-target w-36 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
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
