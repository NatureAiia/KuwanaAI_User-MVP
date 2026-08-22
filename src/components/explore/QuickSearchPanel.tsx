"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { SignalBloom } from "@/components/SignalBloom";
import { FormattedPrice } from "@/components/FormattedPrice";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import { resolveFieldLabel } from "@/lib/fieldLabels";

type QuickSearchResult = { id: string; name: string; provider: string; price: number; currency: string; bciScore: number | null };

/**
 * Flow 4 (Quick Search -> Ranking Engine) — the one comparison flow with no
 * LLM in the loop: a filter box straight into the deterministic engines via
 * /api/quick-search. Filter fields are derived from the category's own enum
 * attributes and the distinct values actually present in its listings, not
 * a hardcoded global list of provinces/customer-types.
 */
export function QuickSearchPanel({
  sectorSlug,
  categorySlug,
  attributeSchema,
  listings,
}: {
  sectorSlug: string;
  categorySlug: string;
  attributeSchema: AttributeSchemaFieldDTO[];
  listings: ListingDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<QuickSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enumFields = useMemo(() => {
    return attributeSchema
      .filter((a) => a.dataType === "enum" && a.isComparable)
      .slice(0, 3)
      .map((field) => {
        const values = [...new Set(listings.map((l) => l.attributes[field.key]).filter((v): v is string => typeof v === "string"))];
        return { field, values };
      })
      .filter((f) => f.values.length > 1);
  }, [attributeSchema, listings]);

  async function runSearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/quick-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectorSlug,
          categorySlug,
          filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
        }),
      });
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setError("Couldn't run the search — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-[var(--radius-card)] border border-border bg-bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tap-target flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-medium text-text-secondary"
      >
        <span className="flex items-center gap-1.5">
          <Search size={14} />
          Quick search — filter straight to a ranked list, no chat needed
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t border-border p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {enumFields.map(({ field, values }) => (
              <label key={field.key} className="flex flex-col gap-1 text-[11.5px] text-text-muted">
                {resolveFieldLabel(field, "consumer")}
                <select
                  value={filters[field.key] ?? ""}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="tap-target rounded-lg border border-border bg-bg-base p-2 text-[13px]"
                >
                  <option value="">Any</option>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">
              Max price
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="No limit"
                className="tap-target rounded-lg border border-border bg-bg-base p-2 text-[13px]"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={runSearch}
            disabled={loading}
            className="tap-target mt-3 rounded-full bg-accent-sky px-4 py-2 text-[13px] font-semibold text-[var(--text-on-accent-sky)] disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>

          {error && <p className="mt-2 text-[12px] text-accent-coral">{error}</p>}

          {results && (
            <div className="mt-3 flex flex-col gap-1.5">
              {results.length === 0 ? (
                <p className="text-[12.5px] text-text-muted">No matches — try loosening a filter.</p>
              ) : (
                results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/listing/${r.id}?sector=${sectorSlug}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg-base px-3 py-2 text-[12.5px] hover:border-accent-sky/50"
                  >
                    <div>
                      <p className="font-medium text-text-primary">{r.name}</p>
                      <p className="text-text-muted">{r.provider}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-semibold">
                        <FormattedPrice amount={r.price} currency={r.currency} />
                      </p>
                      {r.bciScore !== null && <SignalBloom value={r.bciScore} size={32} />}
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
