import type { AttributeSchemaFieldDTO } from "@/types/catalog";
import { isLowerBetterAttribute } from "@/lib/attributeDirection";

/**
 * "Traditional comparison" — a deterministic, rules-based engine, deliberately
 * not an AI/LLM. This replaces the former scripts/traditional_compare.py,
 * which (a) could never actually run in the deployed image — the production
 * Dockerfile's runner stage installs no Python interpreter and never copies
 * scripts/ into the image — and (b) never inverted direction for
 * weighted "lower is better" attributes (monthly_fee, transaction_fee), so it
 * scored a higher fee as better. Running in-process fixes the deployment gap,
 * and importing isLowerBetterAttribute here — the same function
 * src/lib/scoring.ts already uses — fixes the direction bug by giving both
 * engines one shared source of truth instead of a second, drifted copy.
 */

export type TraditionalListingInput = {
  id: string;
  name: string | null;
  provider: string | null;
  providerVerified: boolean;
  price: number | null;
  currency: string | null;
  attributes: Record<string, unknown>;
  freshnessStatus: string | null;
  trendPercent: number | null;
};

export type TraditionalComparisonResult = {
  text: string;
  winner: { name: string; score: number; why: string } | null;
  runnerUps: { name: string; score: number }[];
  note: string | null;
};

// Per-category weights, lifted from notebooks/recommendation_engine.py so this
// on-demand engine agrees with the offline recommender. Categories without an
// entry fall back to the legacy 50/50 price + first-numeric-benefit blend.
const CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  "data-bundles": { price: 0.4, data_amount: 0.4, validity_days: 0.2 },
  "voice-sms-bundles": { price: 0.35, minutes: 0.35, sms_count: 0.2, validity_days: 0.1 },
  "savings-accounts": { price: 0.3, interest_rate: 0.4, monthly_fee: 0.3 },
  "current-accounts": { price: 0.4, transaction_fee: 0.3, branch_count: 0.3 },
  "motor-insurance": { price: 0.35, coverage_amount: 0.45, claim_turnaround_days: 0.2 },
  "life-insurance": { price: 0.3, coverage_amount: 0.4, payout_speed_days: 0.3 },
};

const FRESHNESS_BONUS: Record<string, number> = { fresh: 5, stale: -6, unverified: -12 };
const SPECIAL_BONUS = 20;
const TRUST_BONUS = 5;
const TREND_DROP_THRESHOLD = -5;
const BELOW_MEDIAN_FACTOR = 0.9;

const BAR = "=".repeat(60);

/** Joins reason phrases into one plain sentence: "A", "A and B", or "A, B, and C". */
function speak(reasons: string[]): string {
  if (reasons.length === 0) return "";
  if (reasons.length === 1) return reasons[0];
  if (reasons.length === 2) return `${reasons[0]} and ${reasons[1]}`;
  return `${reasons.slice(0, -1).join(", ")}, and ${reasons[reasons.length - 1]}`;
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalize(values: number[], invert: boolean): number[] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return values.map(() => 100);
  return values.map((v) => {
    const t = (v - lo) / (hi - lo);
    const val = (invert ? 1 - t : t) * 100;
    return Math.round(val * 10) / 10;
  });
}

function firstNumericBenefitKey(schema: AttributeSchemaFieldDTO[]): string | null {
  const numeric = schema
    .filter((a) => a.dataType === "number" && a.isComparable && a.key !== "price")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return numeric[0]?.key ?? null;
}

function fmtAttr(listing: TraditionalListingInput, key: string, schema: AttributeSchemaFieldDTO[]): string {
  const value = listing.attributes[key];
  if (value === undefined || value === null) return "—";
  const unit = schema.find((a) => a.key === key)?.unit;
  return unit ? `${value} ${unit}`.trim() : `${value}`;
}

function computeValueScore(
  listing: TraditionalListingInput,
  categorySlug: string,
  schema: AttributeSchemaFieldDTO[],
  prices: number[],
  comparedSet: TraditionalListingInput[],
): { score: number; blend: string } {
  const weights = CATEGORY_WEIGHTS[categorySlug];
  const attrs = listing.attributes;
  const price = num(listing.price);
  if (price === null) return { score: 0, blend: "no price" };

  const priceScores = normalize(prices, true);
  const priceIdx = prices.indexOf(price);
  const priceScore = priceIdx !== -1 ? priceScores[priceIdx] : 100;

  const column = (key: string): number[] =>
    comparedSet.map((l) => num(l.attributes[key])).filter((v): v is number => v !== null);

  // Direction-aware, unlike the Python original: inverts the normalization
  // for any key attributeDirection.ts flags as "lower is better" (fees,
  // waiting periods, ...) instead of always treating a higher raw value as
  // the better one.
  const scoreAgainstSet = (key: string): number => {
    const col = column(key);
    const raw = num(attrs[key]);
    if (raw === null || col.length < 2) return 100;
    const norm = normalize(col, isLowerBetterAttribute(key));
    const idx = col.indexOf(raw);
    return idx !== -1 ? norm[idx] : 100;
  };

  if (weights) {
    const parts: number[] = [];
    const breakdown: string[] = [];
    for (const [key, weight] of Object.entries(weights)) {
      if (key === "price") {
        parts.push(priceScore * weight);
        breakdown.push(`price ${Math.round(weight * 100)}%`);
        continue;
      }
      const raw = num(attrs[key]);
      if (raw === null) continue;
      parts.push(scoreAgainstSet(key) * weight);
      breakdown.push(`${key} ${Math.round(weight * 100)}%`);
    }
    if (parts.length > 0) {
      const score = Math.round(parts.reduce((a, b) => a + b, 0) * 10) / 10;
      return { score, blend: breakdown.join(" · ") };
    }
    return { score: priceScore, blend: "price only" };
  }

  const benefitKey = firstNumericBenefitKey(schema);
  if (benefitKey === null) return { score: priceScore, blend: "price only (no benefit attribute)" };
  const raw = num(attrs[benefitKey]);
  if (raw === null) return { score: priceScore, blend: "price only" };
  const benefitScore = scoreAgainstSet(benefitKey);
  const total = Math.round((priceScore * 0.5 + benefitScore * 0.5) * 10) / 10;
  return { score: total, blend: "price 50% · benefit 50%" };
}

export function computeTraditionalComparison(params: {
  categoryName: string;
  categorySlug: string;
  attributeSchema: AttributeSchemaFieldDTO[];
  listings: TraditionalListingInput[];
}): TraditionalComparisonResult {
  const { categoryName, categorySlug, attributeSchema: schema, listings } = params;
  if (listings.length < 1) {
    return { text: "No listings to compare.\n", winner: null, runnerUps: [], note: null };
  }

  let prices = listings.map((l) => num(l.price)).filter((p): p is number => p !== null);
  if (prices.length === 0) prices = listings.map(() => 0);
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)] ?? 0;

  type Scored = {
    listing: TraditionalListingInput;
    valueScore: number;
    blend: string;
    final: number;
    bonus: number;
    freshnessBonus: number;
    trustBonus: number;
    reasons: string[];
  };

  const scored: Scored[] = listings.map((listing) => {
    const { score: valueScore, blend } = computeValueScore(listing, categorySlug, schema, prices, listings);

    // Plain, spoken-out-loud phrasing on purpose — this is the sentence shown
    // directly to the user as "Why", so it needs to read like an explanation
    // a ten-year-old would follow, not a scoring log.
    const reasons: string[] = [];
    let special = false;
    const trend = num(listing.trendPercent);
    if (trend !== null && trend <= TREND_DROP_THRESHOLD) {
      special = true;
      reasons.push(`its price just dropped ${Math.round(Math.abs(trend))}%, so it's cheaper than it was recently`);
    }
    const price = num(listing.price);
    if (price !== null && medianPrice > 0 && price <= medianPrice * BELOW_MEDIAN_FACTOR) {
      special = true;
      reasons.push("it costs less than most of the other options here");
    }

    const freshness = listing.freshnessStatus ?? "unverified";
    const freshnessBonus = FRESHNESS_BONUS[freshness] ?? 0;
    if (freshnessBonus > 0) {
      reasons.push("the price we have for it is fresh and up to date");
    } else if (freshness === "stale") {
      reasons.push("the price we have for it is a bit old, so it may have changed");
    } else if (freshness === "unverified") {
      reasons.push("we haven't double-checked this price recently");
    }

    const verified = Boolean(listing.providerVerified);
    const trustBonus = verified ? TRUST_BONUS : 0;
    if (!verified) {
      reasons.push("its provider hasn't been verified yet, so it's worth double-checking");
    }

    const bonus = special ? SPECIAL_BONUS : 0;
    const final = Math.max(
      0,
      Math.min(100, Math.round((valueScore + bonus + freshnessBonus + trustBonus) * 10) / 10),
    );

    return { listing, valueScore, blend, final, bonus, freshnessBonus, trustBonus, reasons };
  });

  scored.sort((a, b) => b.final - a.final);

  const lines: string[] = [];
  lines.push(BAR);
  lines.push("TRADITIONAL COMPARISON — rules-based engine, no AI");
  lines.push(`Category: ${categoryName}`);
  lines.push("Weights: transparent per-category value blend + special/freshness/trust bonuses");
  lines.push(BAR);

  scored.forEach((entry, i) => {
    const rank = i + 1;
    const { listing } = entry;
    const provider = listing.provider ?? "Unknown provider";
    lines.push("");
    lines.push(`${rank}. ${listing.name ?? "Unnamed"}  (${provider})`);
    const price = num(listing.price);
    const currency = listing.currency ?? "";
    const priceTxt =
      price !== null
        ? `${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`.trim()
        : "price —";
    lines.push(`   Price: ${priceTxt}`);
    for (const attr of schema) {
      if (attr.isComparable && attr.key !== "price" && attr.dataType === "number") {
        if (num(listing.attributes[attr.key]) !== null) {
          lines.push(`   ${attr.label || attr.key}: ${fmtAttr(listing, attr.key, schema)}`);
        }
      }
    }
    lines.push(`   Value score: ${entry.valueScore}/100  (${entry.blend})`);
    let detail = entry.bonus ? `   Adjustments: special +${entry.bonus}` : "   Adjustments: none";
    detail += ` · freshness ${entry.freshnessBonus >= 0 ? "+" : ""}${entry.freshnessBonus} · trust ${entry.trustBonus >= 0 ? "+" : ""}${entry.trustBonus}`;
    lines.push(detail);
    lines.push(`   FINAL: ${entry.final}/100`);
    if (entry.reasons.length > 0) {
      lines.push("   Because: " + speak(entry.reasons));
    }
  });

  lines.push("");
  lines.push(BAR);
  const winnerEntry = scored[0];
  const winnerWhy =
    winnerEntry.reasons.length > 0
      ? speak(winnerEntry.reasons)
      : "it scored best overall once we weighed price and features fairly";
  lines.push(`WINNER: ${winnerEntry.listing.name} — ${winnerEntry.final}/100`);
  lines.push(`Why: ${winnerWhy}.`);

  const runnerUps = scored.slice(1, 3).map((s) => ({ name: s.listing.name ?? "Unnamed", score: s.final }));
  if (runnerUps.length > 0) {
    lines.push("");
    lines.push("Runner-up: " + runnerUps.map((r) => `${r.name} (${r.score}/100)`).join(" — "));
  }

  const note = "This is a deterministic rules-based comparison, not an AI recommendation.";
  lines.push("");
  lines.push(`Note: ${note[0].toLowerCase()}${note.slice(1)}`);

  return {
    text: lines.join("\n") + "\n",
    winner: { name: winnerEntry.listing.name ?? "Unnamed", score: winnerEntry.final, why: winnerWhy },
    runnerUps,
    note,
  };
}
