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
import { computeBci, DEFAULT_AXIS_WEIGHTS, QUALITY_AXES, type AxisRatingStats } from "@/lib/bci";
import type { QualityAxis } from "@prisma/client";
import { notifyGamification, type GamificationUpdate } from "@/lib/gamification/client";
import type { CompareShareData } from "@/lib/comparePdf";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";
import { TREND_TONE, TREND_ARROW, resolveProviderLink, NOT_A_RESELLER_NOTICE } from "@/lib/listingDisplay";
import { getListingRequirements, isRequirementAttribute } from "@/lib/eligibility";
import { resolveFieldLabel } from "@/lib/fieldLabels";
import { ExternalLink } from "lucide-react";
import { CategoryIntakeModal } from "@/components/explore/CategoryIntakeModal";
import { getIntakeQuestions } from "@/lib/insuranceIntake";

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
      source_url: string | null;
      website_url: string | null;
      last_verified_at: string;
    };
    alternative_options: {
      listing_id: string;
      provider_name: string;
      listing_title: string;
      key_differentiator: string;
      source_url: string | null;
      website_url: string | null;
      last_verified_at: string;
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

// Matches QualityAxisConfig's seeded displayName values (prisma/seed.ts) —
// hardcoded here rather than fetched, since these are the stable slugs'
// stock labels, not something this page needs to reflect a live admin edit of.
const AXIS_LABELS: Record<QualityAxis, string> = {
  value: "Value for money",
  trust: "Trust & safety",
  availability: "Availability",
  performance: "Performance",
  resilience: "Resilience",
};

let knownItemCounter = 0;

export function CompareClient({
  sectorSlug,
  categoryId,
  categorySlug,
  categoryName,
  listings,
  attributeSchema,
  trends,
  bciInputs,
  initialSavedIds,
  budgetFlexibility,
  constraints,
}: {
  sectorSlug: string;
  categoryId: string;
  categorySlug?: string;
  categoryName: string;
  listings: ListingDTO[];
  attributeSchema: AttributeSchemaFieldDTO[];
  trends: Record<string, PriceTrend | null>;
  // Precomputed server-side (see explore/[sector]/compare/page.tsx) so the
  // weighted BCI composite below can be recomputed client-side on every
  // slider drag with no network round-trip.
  bciInputs?: Record<string, { objective: Record<QualityAxis, number>; ratings: Record<QualityAxis, AxisRatingStats> }>;
  initialSavedIds?: string[];
  budgetFlexibility?: string | null;
  constraints?: string[];
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [recommendation, setRecommendation] = useState<RecommendationResponse["recommendation"] | null>(null);
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const loggedComparison = useRef(false);

  // Insurance-only pre-recommendation clarifying-question step (see
  // lib/insuranceIntake.ts) — checked once against any note already saved
  // for this category so a returning user isn't asked again every time.
  const intakeQuestions = categorySlug ? getIntakeQuestions(sectorSlug, categorySlug) : null;
  const [showIntake, setShowIntake] = useState(false);
  const [savingIntake, setSavingIntake] = useState(false);
  const [hasCheckedIntakeNote, setHasCheckedIntakeNote] = useState(false);
  const [hasIntakeNote, setHasIntakeNote] = useState(false);

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

  // Flow 2 (Product vs Product via Selection): draggable 0-100 weight per
  // axis, live re-ranking the BCI composite below — pure/sync, no API call,
  // since bciInputs' objective/rating pieces were already computed server-side.
  const [axisWeights, setAxisWeights] = useState<Record<QualityAxis, number>>(
    Object.fromEntries(QUALITY_AXES.map((axis) => [axis, Math.round(DEFAULT_AXIS_WEIGHTS[axis] * 100)])) as Record<
      QualityAxis,
      number
    >,
  );
  const bciScores = bciInputs
    ? Object.fromEntries(
        listings.map((l) => [
          l.id,
          bciInputs[l.id] ? computeBci(bciInputs[l.id].objective, bciInputs[l.id].ratings, axisWeights) : null,
        ]),
      )
    : null;

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

  // The click handler behind "Get AI recommendation" — for Insurance
  // categories with intake questions configured, checks whether the user
  // already has a saved note for this category first; if not, shows the
  // CategoryIntakeModal before actually requesting the recommendation.
  // Once a note exists (or the user skips), it goes straight to
  // runRecommendation() on every later click.
  async function getRecommendation() {
    if (intakeQuestions && !hasCheckedIntakeNote) {
      try {
        const params = new URLSearchParams({ sector: sectorSlug, category: categorySlug ?? "" });
        const res = await fetch(`/api/user/notes?${params.toString()}`);
        const data = res.ok ? await res.json() : null;
        setHasCheckedIntakeNote(true);
        if (data?.note) {
          setHasIntakeNote(true);
        } else {
          setShowIntake(true);
          return;
        }
      } catch {
        setHasCheckedIntakeNote(true);
        // Fall through — a failed notes lookup shouldn't block the recommendation itself.
      }
    }
    await runRecommendation();
  }

  async function runRecommendation() {
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

  async function submitIntake(answers: { question: string; answer: string }[]) {
    setSavingIntake(true);
    try {
      if (answers.length > 0 && categorySlug) {
        await fetch("/api/user/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sector: sectorSlug, category: categorySlug, content: answers }),
        });
      }
    } catch {
      // Best-effort — don't block the recommendation on a notes-save failure.
    } finally {
      setSavingIntake(false);
      setShowIntake(false);
      setHasIntakeNote(true);
      await runRecommendation();
    }
  }

  function skipIntake() {
    setShowIntake(false);
    runRecommendation();
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
        <h2 className="font-display text-[22px] font-bold">Compare {categoryName}</h2>
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

      {bciScores && (
        <div className="mt-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-3.5">
          <p className="text-[12.5px] font-medium text-text-secondary">
            Tune what matters to you — drag to re-rank instantly, no need to save anything.
          </p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {QUALITY_AXES.map((axis) => (
              <label key={axis} className="flex flex-col gap-1 text-[11.5px] text-text-muted">
                <span className="flex items-center justify-between">
                  <span className="capitalize">{AXIS_LABELS[axis]}</span>
                  <span className="font-mono">{axisWeights[axis]}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={axisWeights[axis]}
                  onChange={(e) => setAxisWeights((prev) => ({ ...prev, [axis]: Number(e.target.value) }))}
                  className="accent-accent-sky"
                />
              </label>
            ))}
          </div>
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
                        {requirements.map((r) => resolveFieldLabel(r, "consumer")).join(" · ")} required
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
                          {resolveFieldLabel(r, "consumer")} {String(r.value)}
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
            {bciScores && (
              <tr className="border-b border-border bg-accent-sky/5">
                <td className="p-3 font-medium text-text-secondary">Weighted ranking (BCI)</td>
                {listings.map((l) => {
                  const bci = bciScores[l.id];
                  return (
                    <td key={l.id} className="p-3">
                      <SignalBloom value={bci?.total ?? 0} size={44} />
                      {bci && (
                        <p className="mt-1 text-[10px] leading-tight text-text-muted">
                          {QUALITY_AXES.map((axis) => `${AXIS_LABELS[axis].split(" ")[0]} ${Math.round(bci.axisBreakdown[axis].blended)}`).join(" · ")}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}
            {attributeSchema
              .filter((a) => a.isComparable && !isRequirementAttribute(a.key))
              .map((attr) => (
                <tr key={attr.key} className="border-b border-border last:border-0">
                  <td className="p-3 font-medium text-text-secondary">{resolveFieldLabel(attr, "consumer")}</td>
                  {listings.map((l) => (
                    <td key={l.id} className="p-3">
                      {formatValue(l.attributes[attr.key], attr.dataType, attr.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            <tr className="last:border-0">
              <td className="p-3 font-medium text-text-secondary">Source</td>
              {listings.map((l) => {
                const link = resolveProviderLink(l);
                return (
                  <td key={l.id} className="p-3">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-sky hover:underline"
                      >
                        Visit {l.provider.name} <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-[12.5px] text-text-muted">Not provided</span>
                    )}
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      Updated {new Date(l.lastVerifiedAt).toLocaleDateString("en-ZW", { dateStyle: "medium" })}
                    </p>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-text-muted">{NOT_A_RESELLER_NOTICE}</p>

      <div className="mt-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={getRecommendation}
              size="lg"
              disabled={loadingRecommendation || loadingTraditional}
            >
              <Sparkles size={16} />
              All factors considered
            </Button>
            <Button
              onClick={getTraditionalComparison}
              variant="secondary"
              size="lg"
              disabled={loadingRecommendation || loadingTraditional}
            >
              <Scale size={16} />
              Price comparison
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
            Kuwana recommendation is personalised to your situation. Price comparison is a deterministic,
            rules-based ranking — no personalization — that shows exactly how it scored each option.
          </p>
          {recommendationError && <p className="text-[13px] text-accent-coral">{recommendationError}</p>}
          {traditionalError && <p className="text-[13px] text-accent-coral">{traditionalError}</p>}
          {hasIntakeNote && (
            <p className="text-[11.5px] text-text-muted">
              Using your saved {categoryName.toLowerCase()} notes for this recommendation — edit them anytime from
              your profile.
            </p>
          )}
        </div>

        {showIntake && intakeQuestions && (
          <CategoryIntakeModal
            categoryName={categoryName}
            questions={intakeQuestions}
            onSubmit={submitIntake}
            onSkip={skipIntake}
            submitting={savingIntake}
          />
        )}

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
              <p className="font-display text-[14px] font-semibold">Running the price comparison engine…</p>
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
                Price comparison
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
              <div className="mt-2.5 flex items-center gap-2 text-[11.5px]">
                {(() => {
                  const link = recommendation.primary_option.source_url ?? recommendation.primary_option.website_url;
                  return link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-accent-sky hover:underline"
                    >
                      Visit {recommendation.primary_option.provider_name} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="text-text-muted">Source not provided</span>
                  );
                })()}
                <span className="text-text-muted">
                  · Updated{" "}
                  {new Date(recommendation.primary_option.last_verified_at).toLocaleDateString("en-ZW", {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
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
                  {alternatives.map((alt) => {
                    const altLink = alt.source_url ?? alt.website_url;
                    return (
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
                          {altLink && (
                            <>
                              {" "}
                              ·{" "}
                              <a
                                href={altLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[11.5px] font-medium text-accent-sky hover:underline"
                              >
                                Visit {alt.provider_name} <ExternalLink size={10} />
                              </a>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
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
            <p className="mt-1.5 text-[11px] leading-snug text-text-muted">{NOT_A_RESELLER_NOTICE}</p>
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
