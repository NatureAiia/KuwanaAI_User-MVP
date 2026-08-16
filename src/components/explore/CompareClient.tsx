"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Bookmark,
  BookmarkCheck,
  MessageCircle,
  Plus,
  Scale,
  Sparkles,
  X,
} from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { ProviderLogo } from "@/components/ProviderLogo";
import { SignalBloom } from "@/components/SignalBloom";
import { FormattedPrice } from "@/components/FormattedPrice";
import { CompareShareButton } from "@/components/explore/CompareShareButton";
import { computeDecisionScores } from "@/lib/scoring";
import { buildTotalCostSummary, isCostAttribute } from "@/lib/totalCost";
import { notifyGamification, type GamificationUpdate } from "@/lib/gamification/client";
import type { CompareShareData } from "@/lib/comparePdf";
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

type RecommendationResponse = {
  recommendation: {
    primary_option: {
      listing_id: string;
      provider_name: string;
      listing_title: string;
      value_score: number;
      total_cost_summary: string | null;
      key_differentiator: string;
    };
    alternative_options: {
      listing_id: string;
      provider_name: string;
      listing_title: string;
      key_differentiator: string;
    }[];
    eligibility_requirements: {
      listing_id: string;
      requirements_to_qualify: string[];
    }[];
    explanation: {
      summary: string;
      key_tradeoffs: string[];
      data_traceability_notes: string;
    };
    suggested_action: string;
    confidence: number;
  };
  gamification?: GamificationUpdate | null;
};

type TraditionalWinner = { name: string; score: number; why: string };
type TraditionalRunnerUp = { name: string; score: number };

type TraditionalComparisonResponse = {
  engine: "traditional";
  categoryName: string;
  text: string;
  winner: TraditionalWinner | null;
  runnerUps: TraditionalRunnerUp[];
  note: string | null;
};

type TraditionalResult = {
  winner: TraditionalWinner | null;
  runnerUps: TraditionalRunnerUp[];
  note: string | null;
  text: string;
};

type KnownItem = { id: string; name: string; provider: string };

let knownItemCounter = 0;

export function CompareClient({
  sectorSlug,
  categoryId,
  categoryName,
  listings,
  attributeSchema,
  trends,
  initialSavedIds,
  budgetFlexibility,
  constraints,
}: {
  sectorSlug: string;
  categoryId: string;
  categoryName: string;
  listings: ListingDTO[];
  attributeSchema: AttributeSchemaFieldDTO[];
  trends: Record<string, PriceTrend | null>;
  initialSavedIds?: string[];
  budgetFlexibility?: string | null;
  constraints?: string[];
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [recommendation, setRecommendation] = useState<RecommendationResponse["recommendation"] | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const loggedComparison = useRef(false);

  // Traditional (Python, rules-based) comparison — deliberately separate from
  // the AI state so either engine can run independently of the other.
  const [traditionalResult, setTraditionalResult] = useState<TraditionalResult | null>(null);
  const [loadingTraditional, setLoadingTraditional] = useState(false);
  const [traditionalError, setTraditionalError] = useState<string | null>(null);

  // Items the user already knows about — client-side only, never scored,
  // shown as a separate clearly-labelled row so nobody mistakes them for a
  // scored option.
  const [knownItems, setKnownItems] = useState<KnownItem[]>([]);
  const [showKnownForm, setShowKnownForm] = useState(false);
  const [knownName, setKnownName] = useState("");
  const [knownProvider, setKnownProvider] = useState("");

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
        body: JSON.stringify({
          listingIds: listings.map((l) => l.id),
          categoryName,
          budgetFlexibility: budgetFlexibility ?? undefined,
          constraints,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as RecommendationResponse;
        setRecommendation(data.recommendation);
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

  async function getTraditionalComparison() {
    setLoadingTraditional(true);
    setTraditionalError(null);
    try {
      const res = await fetch("/api/traditional-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: listings.map((l) => l.id) }),
      });
      if (res.ok) {
        const data = (await res.json()) as TraditionalComparisonResponse;
        setTraditionalResult({ winner: data.winner, runnerUps: data.runnerUps, note: data.note, text: data.text });
      } else {
        const data = await res.json().catch(() => null);
        setTraditionalError(
          typeof data?.error === "string" ? data.error : "The comparison engine didn't return results — try again.",
        );
      }
    } catch {
      setTraditionalError("Couldn't reach the comparison engine — check your connection and try again.");
    } finally {
      setLoadingTraditional(false);
    }
  }

  function addKnownItem(e: React.FormEvent) {
    e.preventDefault();
    const name = knownName.trim();
    if (!name) return;
    setKnownItems((prev) => [
      ...prev,
      { id: `known-${++knownItemCounter}`, name, provider: knownProvider.trim() },
    ]);
    setKnownName("");
    setKnownProvider("");
    setShowKnownForm(false);
  }

  function removeKnownItem(id: string) {
    setKnownItems((prev) => prev.filter((i) => i.id !== id));
  }

  const listingById = new Map(listings.map((l) => [l.id, l]));
  const alternatives = recommendation?.alternative_options ?? [];
  const requirementRows = (recommendation?.eligibility_requirements ?? []).filter(
    (r) => r.requirements_to_qualify.length > 0,
  );

  // Carries the same budget/constraint context the AI recommendation used
  // into the "Ask in chat" links, so a follow-up question there is grounded
  // on what the user already told the compare page, not just the raw listings.
  const chatHref = (() => {
    const params = new URLSearchParams({ listingIds: listings.map((l) => l.id).join(",") });
    if (budgetFlexibility) params.set("budgetFlexibility", budgetFlexibility);
    if (constraints && constraints.length > 0) params.set("constraints", constraints.join(","));
    return `/chat?${params.toString()}`;
  })();

  const shareData: CompareShareData = {
    categoryName,
    listings,
    attributeSchema,
    trends,
    recommendation,
    traditional: traditionalResult,
  };

  return (
    <div className="mt-4">
      {/* Header row: title on the left, share-as-PDF action on the right. */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold">Compare {categoryName}</h1>
        <CompareShareButton data={shareData} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <button
          type="button"
          onClick={() => setShowKnownForm((v) => !v)}
          aria-expanded={showKnownForm}
          className="tap-target flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-accent-teal"
        >
          <Plus size={13} />
          Add an item you know
        </button>
      </div>

      {showKnownForm && (
        <form
          onSubmit={addKnownItem}
          className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3"
        >
          <p className="w-full text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Add a product you already use or know — it won&apos;t be scored
          </p>
          <input
            type="text"
            value={knownName}
            onChange={(e) => setKnownName(e.target.value)}
            placeholder="Product name, e.g. OneFusion Monthly 15GB"
            required
            className="min-w-0 flex-1 rounded-xl border border-border bg-bg-base px-3 py-2 text-[13px] outline-none placeholder:text-text-muted focus:border-accent-sky"
          />
          <input
            type="text"
            value={knownProvider}
            onChange={(e) => setKnownProvider(e.target.value)}
            placeholder="Provider (optional)"
            className="w-36 rounded-xl border border-border bg-bg-base px-3 py-2 text-[13px] outline-none placeholder:text-text-muted focus:border-accent-sky"
          />
          <Button type="submit" size="md">
            Add
          </Button>
          <button
            type="button"
            onClick={() => setShowKnownForm(false)}
            className="tap-target text-[13px] font-medium text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </form>
      )}

      {knownItems.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-[var(--radius-card)] border border-dashed border-border bg-bg-surface p-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            You know these (not scored)
          </span>
          {knownItems.map((item) => (
            <span
              key={item.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-bg-surface-raised py-1 pl-2.5 pr-1 text-[12px] font-medium"
            >
              {item.name}
              {item.provider ? <span className="text-text-muted">· {item.provider}</span> : null}
              <button
                type="button"
                onClick={() => removeKnownItem(item.id)}
                aria-label={`Remove ${item.name}`}
                className="tap-target flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:text-accent-coral"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {(budgetFlexibility || (constraints && constraints.length > 0)) && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] text-text-muted">
          {budgetFlexibility && (
            <Badge tone="neutral">
              Budget:{" "}
              {budgetFlexibility === "low"
                ? "cheapest acceptable option"
                : budgetFlexibility === "medium"
                  ? "value for money"
                  : "not the deciding factor"}
            </Badge>
          )}
          {constraints && constraints.length > 0 && (
            <Badge tone="neutral">Constraints: {constraints.join(", ")}</Badge>
          )}
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised">
              <th className="p-3 text-left font-medium text-text-muted">Attribute</th>
              {listings.map((l) => {
                const requirements = getListingRequirements(l, attributeSchema);
                const isSaved = savedIds.has(l.id);
                return (
                  <th key={l.id} className="p-3 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/listing/${l.id}?sector=${sectorSlug}`} className="hover:text-accent-sky">
                        <p className="font-display font-semibold">{l.name}</p>
                        <p className="text-[11px] font-normal text-text-muted">
                          {l.provider.name}
                          {!l.provider.verified && <span className="text-accent-coral"> · Unverified</span>}
                        </p>
                      </Link>
                    </div>
                    {requirements.length > 0 && (
                      <Badge tone="coral" className="mt-1.5">
                        {requirements.map((r) => r.label).join(" · ")} required
                      </Badge>
                    )}
                    <button
                      onClick={() => toggleSave(l.id)}
                      aria-label={isSaved ? "Unsave" : "Save"}
                      aria-pressed={isSaved}
                      className={clsx(
                        "tap-target mt-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                        isSaved
                          ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                          : "border-border bg-bg-surface text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky",
                      )}
                    >
                      {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                      {isSaved ? "Saved" : "Save"}
                    </button>
                  </th>
                );
              })}
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
            {attributeSchema.some((a) => isCostAttribute(a.key)) && (
              <tr className="border-b border-border bg-bg-surface-raised/40">
                <td className="p-3 font-medium text-text-secondary">Total cost</td>
                {listings.map((l) => {
                  const summary = buildTotalCostSummary(l, attributeSchema);
                  return (
                    <td key={l.id} className="p-3 text-[12.5px] leading-snug">
                      {summary ?? <span className="text-text-muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            )}
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
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={getRecommendation}
              size="lg"
              disabled={loadingRecommendation || loadingTraditional}
            >
              <Sparkles size={16} />
              Get AI recommendation
            </Button>
            <Button
              onClick={getTraditionalComparison}
              variant="secondary"
              size="lg"
              disabled={loadingRecommendation || loadingTraditional}
            >
              <Scale size={16} />
              Traditional comparison
            </Button>
            <LinkButton
              variant="ghost"
              size="lg"
              href={chatHref}
            >
              <MessageCircle size={16} />
              Ask in chat
            </LinkButton>
          </div>
          {/* Clearly-labelled explanation of which engine is which, under the
              buttons, so the two results aren't mistaken for each other. */}
          <p className="max-w-xl text-[12px] leading-snug text-text-muted">
            Kuwana recommendation is personalised to your situation. Traditional comparison is a deterministic,
            rules-based ranking — no personalization — that shows exactly how it scored each option.
          </p>
          {recommendationError && <p className="text-[13px] text-accent-coral">{recommendationError}</p>}
          {traditionalError && <p className="text-[13px] text-accent-coral">{traditionalError}</p>}
        </div>

        {loadingRecommendation && (
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
            <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-accent-sky border-t-transparent" />
            <div>
              <p className="font-display text-[14px] font-semibold">Comparing decision scores…</p>
              <p className="text-[12px] text-text-muted">
                Weighing price, fit, freshness, trend, and cost across {listings.length} listings
              </p>
            </div>
          </div>
        )}

        {loadingTraditional && (
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
            <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-accent-teal border-t-transparent" />
            <div>
              <p className="font-display text-[14px] font-semibold">Running the traditional comparison engine…</p>
              <p className="text-[12px] text-text-muted">
                A deterministic Python engine is scoring {listings.length} listings — no AI involved
              </p>
            </div>
          </div>
        )}

        {traditionalResult && (
          <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                <Scale size={13} />
                Traditional comparison
              </p>
              <button
                type="button"
                onClick={() => setTraditionalResult(null)}
                className="tap-target text-[12px] font-medium text-text-muted hover:text-text-primary"
              >
                Hide
              </button>
            </div>

            {traditionalResult.winner && (
              <>
                <p className="mt-3 font-display text-[16px] font-semibold">
                  {traditionalResult.winner.name}{" "}
                  <span className="text-accent-teal">{traditionalResult.winner.score}/100</span>
                </p>
                <p className="mt-1 text-[13px] leading-snug text-text-secondary">
                  <span className="font-semibold text-text-primary">Why:</span> {traditionalResult.winner.why}
                </p>
              </>
            )}

            {traditionalResult.runnerUps.length > 0 && (
              <p className="mt-2.5 text-[12.5px] leading-snug text-text-muted">
                <span className="font-semibold">Runner-up:</span>{" "}
                {traditionalResult.runnerUps.map((r) => `${r.name} (${r.score}/100)`).join(" — ")}
              </p>
            )}

            {traditionalResult.note && (
              <p className="mt-3 text-[11px] leading-snug text-text-muted">{traditionalResult.note}</p>
            )}
          </div>
        )}

        {recommendation && (
          <div className="rounded-[var(--radius-card)] border border-accent-teal/40 bg-accent-teal/5 p-5">
            <div className="flex items-center gap-2">
              <SignalBloom value={recommendation.confidence * 100} size={40} color="teal" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-teal">
                  Kuwana recommendation
                </p>
                <p className="font-display text-[15px] font-semibold">Best for you because…</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-accent-teal/30 bg-bg-surface p-4">
              <div className="flex items-center gap-2.5">
                <ProviderLogo
                  name={recommendation.primary_option.provider_name}
                  logoUrl={listingById.get(recommendation.primary_option.listing_id)?.provider.logoUrl}
                  size={28}
                />
                <div className="min-w-0">
                  <p className="truncate font-display text-[14px] font-semibold">
                    {recommendation.primary_option.listing_title}
                  </p>
                  <p className="text-[11px] text-text-muted">{recommendation.primary_option.provider_name}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge tone="sky">Decision score {recommendation.primary_option.value_score}</Badge>
                {recommendation.primary_option.total_cost_summary && (
                  <Badge tone="neutral">Total cost: {recommendation.primary_option.total_cost_summary}</Badge>
                )}
                {(() => {
                  const trend = trends[recommendation.primary_option.listing_id];
                  if (!trend) return null;
                  return (
                    <Badge tone={TREND_TONE[trend.direction]}>
                      {TREND_ARROW[trend.direction]} {Math.abs(trend.changePercent)}% / {trend.periodDays}d
                    </Badge>
                  );
                })()}
              </div>
              {recommendation.primary_option.key_differentiator && (
                <p className="mt-2.5 text-[13px] leading-snug text-text-secondary">
                  {recommendation.primary_option.key_differentiator}
                </p>
              )}
            </div>

            <p className="mt-4 text-[14px] leading-[1.6] text-text-secondary">
              {recommendation.explanation.summary}
            </p>

            {recommendation.explanation.key_tradeoffs.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Tradeoffs to weigh
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {recommendation.explanation.key_tradeoffs.map((t, i) => (
                    <li key={i} className="flex gap-1.5 text-[13px] leading-snug text-text-secondary">
                      <span className="shrink-0 text-accent-sky">·</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {alternatives.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  Also worth considering
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {alternatives.map((alt) => (
                    <li key={alt.listing_id} className="flex gap-1.5 text-[13px] leading-snug text-text-secondary">
                      <span className="shrink-0 text-accent-teal">→</span>
                      <span>
                        <Link
                          href={`/listing/${alt.listing_id}?sector=${sectorSlug}`}
                          className="font-semibold text-accent-sky hover:underline"
                        >
                          {alt.listing_title}
                        </Link>{" "}
                        — {alt.key_differentiator}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requirementRows.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">To qualify</p>
                <ul className="mt-1.5 space-y-1.5">
                  {requirementRows.map((row) => (
                    <li key={row.listing_id} className="flex gap-1.5 text-[13px] leading-snug text-text-secondary">
                      <span className="shrink-0 text-accent-coral">!</span>
                      <span>
                        <Link
                          href={`/listing/${row.listing_id}?sector=${sectorSlug}`}
                          className="font-semibold hover:underline"
                        >
                          {listingById.get(row.listing_id)?.name ?? row.listing_id}
                        </Link>
                        : {row.requirements_to_qualify.join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recommendation.suggested_action && (
              <div className="mt-4 rounded-lg border border-accent-sky/30 bg-accent-sky/10 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-sky">
                  Suggested next step
                </p>
                <p className="mt-1 text-[13px] leading-snug text-text-secondary">
                  {recommendation.suggested_action}
                </p>
              </div>
            )}

            <p className="mt-4 text-[11px] leading-snug text-text-muted">
              {recommendation.explanation.data_traceability_notes}
            </p>
            <Link
              href={chatHref}
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
