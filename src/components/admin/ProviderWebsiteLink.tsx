"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ProviderWebsiteLink({
  providerId,
  currentWebsiteUrl,
}: {
  providerId: string;
  currentWebsiteUrl: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(currentWebsiteUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: url.trim() || null }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Failed to save website");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="tap-target flex max-w-[200px] items-center gap-1.5 truncate text-[12.5px] text-text-secondary hover:text-accent-sky"
      >
        {currentWebsiteUrl ? (
          <span className="truncate">{currentWebsiteUrl.replace(/^https?:\/\//, "")}</span>
        ) : (
          <span className="italic text-text-muted">Not set</span>
        )}
        <Pencil size={12} className="shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="url"
          placeholder="https://provider.co.zw"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="tap-target w-48 rounded-lg border border-border bg-bg-surface p-1.5 text-[12px]"
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
