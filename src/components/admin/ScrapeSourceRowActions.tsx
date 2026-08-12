"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ScrapeSourceRowActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"toggle" | "run" | "delete" | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function toggleEnabled() {
    setLoading("toggle");
    try {
      await fetch(`/api/admin/scrape-sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function runNow() {
    setLoading("run");
    setRunError(null);
    try {
      const res = await fetch(`/api/admin/scrape-sources/${id}/run`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setRunError(data?.error ?? "Run failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function remove() {
    if (!confirm("Remove this source? It won't be crawled again.")) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/admin/scrape-sources/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="tap-target flex items-center gap-1.5 text-[11.5px] text-text-secondary">
          <input type="checkbox" checked={enabled} disabled={loading !== null} onChange={toggleEnabled} />
          Enabled
        </label>
        <Button
          variant="secondary"
          size="md"
          onClick={runNow}
          disabled={loading !== null}
          className="!px-2.5 !py-1.5 !text-[12px]"
        >
          <Play size={13} />
          {loading === "run" ? "Running…" : "Run now"}
        </Button>
        <button
          onClick={remove}
          disabled={loading !== null}
          aria-label="Remove source"
          className="tap-target rounded-lg border border-border p-1.5 text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {runError && <p className="text-[11px] text-accent-coral">{runError}</p>}
    </div>
  );
}
