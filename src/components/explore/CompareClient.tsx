"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SignalBloom } from "@/components/SignalBloom";
import { computeValueScores } from "@/lib/scoring";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

function formatValue(value: unknown, dataType: AttributeSchemaFieldDTO["dataType"], unit: string | null) {
  if (value === undefined || value === null) return "—";
  if (dataType === "boolean") return value ? "Yes" : "No";
  if (dataType === "number") return `${value}${unit ? ` ${unit}` : ""}`;
  return String(value);
}

export function CompareClient({
  sectorSlug,
  categoryId,
  categoryName,
  listings,
  attributeSchema,
}: {
  sectorSlug: string;
  categoryId: string;
  categoryName: string;
  listings: ListingDTO[];
  attributeSchema: AttributeSchemaFieldDTO[];
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [recommendation, setRecommendation] = useState<{
    listingId: string;
    explanation: string;
    confidence: number;
  } | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const loggedComparison = useRef(false);

  const scores = computeValueScores(listings, attributeSchema);

  useEffect(() => {
    if (loggedComparison.current) return;
    loggedComparison.current = true;
    fetch("/api/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, listingIds: listings.map((l) => l.id) }),
    }).catch(() => {});
  }, [categoryId, listings]);

  async function toggleSave(listingId: string) {
    const isSaved = savedIds.has(listingId);
    const method = isSaved ? "DELETE" : "POST";
    await fetch("/api/saved", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    }).catch(() => {});
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }

  async function getRecommendation() {
    setLoadingRecommendation(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: listings.map((l) => l.id), categoryName }),
      });
      if (res.ok) setRecommendation(await res.json());
    } finally {
      setLoadingRecommendation(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised">
              <th className="p-3 text-left font-medium text-text-muted">Attribute</th>
              {listings.map((l) => (
                <th key={l.id} className="p-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-display font-semibold">{l.name}</p>
                      <p className="text-[11px] font-normal text-text-muted">{l.provider.name}</p>
                    </div>
                    <button
                      onClick={() => toggleSave(l.id)}
                      aria-label={savedIds.has(l.id) ? "Unsave" : "Save"}
                      className="tap-target text-accent-gold"
                    >
                      {savedIds.has(l.id) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <td className="p-3 font-medium text-text-secondary">Price</td>
              {listings.map((l) => (
                <td key={l.id} className="p-3 font-mono font-semibold">
                  {l.currency} {l.price.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border">
              <td className="p-3 font-medium text-text-secondary">Value score</td>
              {listings.map((l) => (
                <td key={l.id} className="p-3">
                  <SignalBloom value={scores[l.id] ?? 0} size={44} />
                </td>
              ))}
            </tr>
            {attributeSchema
              .filter((a) => a.isComparable)
              .map((attr) => (
                <tr key={attr.key} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-text-secondary">{attr.label}</td>
                  {listings.map((l) => (
                    <td key={l.id} className="p-3">
                      {formatValue(l.attributes[attr.key], attr.dataType, attr.unit)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        {!recommendation && (
          <Button onClick={getRecommendation} disabled={loadingRecommendation} size="lg">
            <Sparkles size={16} />
            {loadingRecommendation ? "Thinking…" : "Get AI recommendation"}
          </Button>
        )}

        {recommendation && (
          <div className="rounded-[var(--radius-card)] border border-accent-teal/40 bg-accent-teal/5 p-5">
            <div className="flex items-center gap-2">
              <SignalBloom value={recommendation.confidence * 100} size={40} color="teal" />
              <p className="font-display text-[15px] font-semibold">Best for you because…</p>
            </div>
            <p className="mt-3 text-[14px] leading-[1.6] text-text-secondary">
              {recommendation.explanation}
            </p>
            <p className="mt-3 text-[11px] text-text-muted">
              AI-assisted recommendation based on the listings above. Not financial advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
