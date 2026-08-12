"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type CategoryOption = { id: string; name: string; sector: { name: string } };

export function ScrapeSearchBox({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scrape-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, ...(categoryId ? { categoryId } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Search failed");
        return;
      }
      setQuery("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-2.5">
        <p className="font-display text-[14px] font-semibold">Search the web</p>
        <p className="text-[11.5px] text-text-muted">
          Runs a web search, fetches the top results, and files each one in the review queue below —
          nothing is shown until it&apos;s been through extraction and matching.
        </p>

        <input
          required
          placeholder="e.g. CBZ savings account interest rate"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
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
          <Search size={14} />
          {loading ? "Searching…" : "Search"}
        </Button>
      </Card>
    </form>
  );
}
