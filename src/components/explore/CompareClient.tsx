"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { SignalBloom } from "@/components/SignalBloom";
import { computeDecisionScores } from "@/lib/scoring";
import { notifyGamification } from "@/lib/gamification/client";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";

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
  trends,
}: {
  sectorSlug: string;
  categoryId: string;
  categoryName: string;
  listings: ListingDTO[];
  attributeSchema: AttributeSchemaFieldDTO[];
  trends: Record<string, PriceTrend | null>;
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [recommendation, setRecommendation] = useState<{
    listingId: string;
    explanation: string;
    confidence: number;
  } | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const loggedComparison = useRef(false);

  const scores = computeDecisionScores(listings, attributeSchema, trends);

  useEffect(() => {
    if (loggedComparison.current) return;
    loggedComparison.current = true;
    fetch("/api/comparisons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, listingIds: listings.map((l) => l.id) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => notifyGamification(data?.gamification))
      .catch(() => {});
  }, [categoryId, listings]);

  async function toggleSave(listingId: string) {
    const isSaved = savedIds.has(listingId);
    const method = isSaved ? "DELETE" : "POST";
    const res = await fetch("/api/saved", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    }).catch(() => null);
    if (res?.ok && method === "POST") {
      const data = await res.json();
      notifyGamification(data?.gamification);
    }
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
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data);
        notifyGamification(data?.gamification);
      }
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
                    <Link href={`/listing/${l.id}?sector=${sectorSlug}`} className="hover:text-accent-sky">
                      <p className="font-display font-semibold">{l.name}</p>
                      <p className="text-[11px] font-normal text-text-muted">
                        {l.provider.name}
                        {!l.provider.verified && <span className="text-accent-coral"> · Unverified</span>}
                      </p>
                    </Link>
                    <button
                      onClick={() => toggleSave(l.id)}
                      aria-label={savedIds.has(l.id) ? "Unsave" : "Save"}
                      className="tap-target text-accent-sky"
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
              <td className="p-3 font-medium text-text-secondary">Price trend</td>
              {listings.map((l) => {
                const trend = trends[l.id];
                if (!trend) {
                  return (
                    <td key={l.id} className="p-3 text-text-muted">
                      —
                    </td>
                  );
                }
                return (
                  <td key={l.id} className="p-3">
                    <Badge tone={TREND_TONE[trend.direction]}>
                      {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}% / {trend.periodDays}d
                    </Badge>
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-border">
              <td className="p-3 font-medium text-text-secondary">Decision score</td>
              {listings.map((l) => {
                const breakdown = scores[l.id];
                return (
                  <td key={l.id} className="p-3">
                    <SignalBloom value={breakdown?.total ?? 0} size={44} />
                    <p className="mt-1 text-[10px] leading-tight text-text-muted">
                      Price {breakdown?.priceScore ?? 0}
                      {breakdown?.benefitScore !== null && breakdown?.benefitScore !== undefined
                        ? ` · Fit ${breakdown.benefitScore}`
                        : ""}
                      {breakdown?.freshnessAdjustment ? ` · Fresh ${breakdown.freshnessAdjustment}` : ""}
                      {breakdown?.trendAdjustment
                        ? ` · Trend ${breakdown.trendAdjustment > 0 ? "+" : ""}${breakdown.trendAdjustment}`
                        : ""}
                      {breakdown?.trustAdjustment ? ` · Trust ${breakdown.trustAdjustment}` : ""}
                    </p>
                  </td>
                );
              })}
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
            {(() => {
              const breakdown = scores[recommendation.listingId];
              const trend = trends[recommendation.listingId];
              if (!breakdown) return null;
              return (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="sky">Decision score {breakdown.total}</Badge>
                  <Badge tone="neutral">Price {breakdown.priceScore}</Badge>
                  {breakdown.benefitScore !== null && <Badge tone="neutral">Fit {breakdown.benefitScore}</Badge>}
                  {breakdown.trustAdjustment !== 0 && <Badge tone="coral">Unverified provider</Badge>}
                  {trend && (
                    <Badge tone={TREND_TONE[trend.direction]}>
                      {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}% / {trend.periodDays}d
                    </Badge>
                  )}
                </div>
              );
            })()}
            <p className="mt-3 text-[11px] text-text-muted">
              AI-assisted recommendation based on the decision score and price trend above. Not financial advice.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
