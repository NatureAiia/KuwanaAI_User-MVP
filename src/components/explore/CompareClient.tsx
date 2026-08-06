"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, MessageCircle, Sparkles } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { ProviderLogo } from "@/components/ProviderLogo";
import { SignalBloom } from "@/components/SignalBloom";
import { FormattedPrice } from "@/components/FormattedPrice";
import { computeDecisionScores } from "@/lib/scoring";
import { notifyGamification } from "@/lib/gamification/client";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { TREND_TONE, TREND_ARROW } from "@/lib/listingDisplay";
import { getListingRequirements, isRequirementAttribute } from "@/lib/eligibility";

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
  initialSavedIds,
}: {
  sectorSlug: string;
  categoryId: string;
  categoryName: string;
  listings: ListingDTO[];
  attributeSchema: AttributeSchemaFieldDTO[];
  trends: Record<string, PriceTrend | null>;
  initialSavedIds?: string[];
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [recommendation, setRecommendation] = useState<{
    listingId: string;
    explanation: string;
    confidence: number;
  } | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
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
    setRecommendationError(null);
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
      } else {
        // Previously silent — a failed response just reverted the button
        // with no explanation, indistinguishable from the click not having
        // registered at all.
        const data = await res.json().catch(() => null);
        setRecommendationError(
          typeof data?.error === "string" ? data.error : "Couldn't get a recommendation — please try again.",
        );
      }
    } catch {
      setRecommendationError("Couldn't reach Kuwana — check your connection and try again.");
    } finally {
      setLoadingRecommendation(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        {listings.map((l) => (
          <span
            key={l.id}
            className="flex items-center gap-1.5 rounded-full border border-border bg-bg-surface py-1 pl-1.5 pr-3 text-[12px] font-medium"
          >
            <ProviderLogo name={l.provider.name} logoUrl={l.provider.logoUrl} size={18} />
            {l.name}
          </span>
        ))}
        <Link
          href={`/explore/${sectorSlug}`}
          className="tap-target text-[12px] font-semibold text-accent-sky hover:underline"
        >
          Change selection
        </Link>
      </div>

      <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-border">
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
            {attributeSchema.some((a) => isRequirementAttribute(a.key)) && (
              <tr className="border-b border-border bg-accent-sky/5">
                <td className="p-3 font-medium text-text-secondary">To qualify</td>
                {listings.map((l) => {
                  const requirements = getListingRequirements(l, attributeSchema);
                  if (requirements.length === 0) {
                    return (
                      <td key={l.id} className="p-3 text-text-muted">
                        No stated requirement
                      </td>
                    );
                  }
                  return (
                    <td key={l.id} className="p-3">
                      {requirements.map((r) => (
                        <Badge key={r.key} tone="sky">
                          {r.label} {String(r.value)}
                          {r.unit ? ` ${r.unit}` : ""}
                        </Badge>
                      ))}
                    </td>
                  );
                })}
              </tr>
            )}
            <tr className="border-b border-border">
              <td className="p-3 font-medium text-text-secondary">Price</td>
              {listings.map((l) => (
                <td key={l.id} className="p-3 font-mono font-semibold">
                  <FormattedPrice amount={l.price} currency={l.currency} />
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
              .filter((a) => a.isComparable && !isRequirementAttribute(a.key))
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
        {!recommendation && !loadingRecommendation && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={getRecommendation} size="lg">
                <Sparkles size={16} />
                Get AI recommendation
              </Button>
              <LinkButton
                variant="secondary"
                size="lg"
                href={`/chat?listingIds=${listings.map((l) => l.id).join(",")}`}
              >
                <MessageCircle size={16} />
                Ask in chat
              </LinkButton>
            </div>
            {recommendationError && <p className="text-[13px] text-accent-coral">{recommendationError}</p>}
          </div>
        )}

        {loadingRecommendation && (
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
            <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-accent-sky border-t-transparent" />
            <div>
              <p className="font-display text-[14px] font-semibold">Comparing decision scores…</p>
              <p className="text-[12px] text-text-muted">
                Weighing price, fit, freshness, and trend across {listings.length} listings
              </p>
            </div>
          </div>
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
            <Link
              href={`/chat?listingIds=${listings.map((l) => l.id).join(",")}`}
              className="tap-target mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-sky hover:underline"
            >
              <MessageCircle size={14} />
              Ask a follow-up in chat
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
