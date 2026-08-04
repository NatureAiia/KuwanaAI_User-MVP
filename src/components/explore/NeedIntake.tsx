"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function NeedIntake() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notSure, setNotSure] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setNotSure(false);

    try {
      const res = await fetch("/api/need-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = res.ok ? await res.json() : null;

      if (data?.sectorSlug) {
        const url = data.categorySlug
          ? `/explore/${data.sectorSlug}?category=${data.categorySlug}`
          : `/explore/${data.sectorSlug}`;
        router.push(url);
      } else {
        setNotSure(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent-teal" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you need? e.g. &quot;a cheap data bundle&quot;"
            className="w-full rounded-xl border border-border bg-bg-surface py-3 pl-10 pr-4 text-[14px] outline-none focus:border-accent-sky"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Finding…" : "Find it"}
        </Button>
      </form>
      {notSure && (
        <p className="mt-2 text-[12px] text-text-muted">
          Not sure what fits that — pick a sector below instead.
        </p>
      )}
    </div>
  );
}
