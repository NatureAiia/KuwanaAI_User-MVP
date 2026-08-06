"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import type { CategoryOption } from "@/components/provider/types";

export function CategoryStep({
  categories,
  categoryId,
  onSelect,
  locked,
}: {
  categories: CategoryOption[];
  categoryId: string | null;
  onSelect: (id: string) => void;
  locked: boolean;
}) {
  const [query, setQuery] = useState("");
  const selected = categories.find((c) => c.id === categoryId) ?? null;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? categories.filter((c) => c.name.toLowerCase().includes(q) || c.sector.name.toLowerCase().includes(q))
      : categories;
    const bySector = new Map<string, { sectorName: string; items: CategoryOption[] }>();
    for (const c of filtered) {
      const entry = bySector.get(c.sector.slug) ?? { sectorName: c.sector.name, items: [] as CategoryOption[] };
      entry.items.push(c);
      bySector.set(c.sector.slug, entry);
    }
    return [...bySector.values()];
  }, [categories, query]);

  if (locked) {
    return (
      <div>
        <p className="font-display text-[16px] font-semibold">Category</p>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Can&apos;t be changed after a product is created — delete it and add a new one under a different category
          instead.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-bg-surface-raised px-4 py-2 text-[13px] font-semibold">
          {selected ? `${selected.sector.name} · ${selected.name}` : "Unknown category"}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-display text-[16px] font-semibold">What are you listing?</p>
      <div className="relative mt-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories…"
          className="tap-target w-full rounded-xl border border-border bg-bg-surface-raised py-2.5 pl-9 pr-3 text-[14px] outline-none focus:border-accent-sky"
        />
      </div>
      <div className="mt-4 max-h-[360px] space-y-4 overflow-y-auto pr-1">
        {grouped.map((g) => (
          <div key={g.sectorName}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g.sectorName}</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {g.items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={clsx(
                    "tap-target rounded-full border px-3.5 py-2 text-[13px] font-medium",
                    c.id === categoryId
                      ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                      : "border-border text-text-secondary hover:border-accent-sky/50",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && <p className="text-[13px] text-text-muted">No categories match &quot;{query}&quot;.</p>}
      </div>
    </div>
  );
}
