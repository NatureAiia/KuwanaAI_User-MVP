"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type CategoryOption = { id: string; name: string; sector: { name: string } };

export function ScrapeSourceForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scrape-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, ...(categoryId ? { categoryId } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Failed to add source");
        return;
      }
      setName("");
      setUrl("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-2.5">
        <p className="font-display text-[14px] font-semibold">Add a source to crawl</p>

        <input
          required
          placeholder="Name, e.g. Econet tariffs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        <input
          required
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        {categories.length > 0 && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sector.name} / {c.name}
              </option>
            ))}
          </select>
        )}

        {error && <p className="text-[12px] text-accent-coral">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full justify-center">
          {loading ? "Adding…" : "Add source"}
        </Button>

        <p className="text-[11.5px] text-text-muted">
          Crawled daily by cron, or on demand with &quot;Run now&quot; below. Every page lands in the
          review queue — nothing here publishes automatically.
        </p>
      </Card>
    </form>
  );
}
