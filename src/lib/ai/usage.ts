import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findModel, type AiFeature, type ModelSpec } from "./models";
import { getLadders } from "./modelConfig";

/**
 * Writes one llm_usage row. Deliberately swallows its own failures: this is
 * telemetry sitting directly in the request path of every AI feature, and a
 * logging table being unreachable must not turn a working chat reply into a
 * 500. A dropped row costs an admin some accuracy; a thrown one costs the user
 * their answer.
 */
export async function recordUsage(params: {
  model: ModelSpec;
  feature: AiFeature;
  userId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  errorMessage?: string;
  /** 1 for the rung tier routing chose; higher once a failure escalated. */
  attempt?: number;
  escalatedFrom?: string | null;
  complexity?: number;
}): Promise<void> {
  try {
    await prisma.llmUsage.create({
      data: {
        provider: params.model.provider,
        model: params.model.id,
        feature: params.feature,
        userId: params.userId ?? null,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        costUsd: new Prisma.Decimal(params.costUsd.toFixed(10)),
        latencyMs: params.latencyMs,
        ok: params.ok,
        attempt: params.attempt ?? 1,
        escalatedFrom: params.escalatedFrom ?? null,
        complexity: params.complexity ?? null,
        // Provider errors can be long and occasionally echo request content.
        // Truncated to keep the table narrow and the admin table readable.
        errorMessage: params.errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[ai] failed to record usage:", err);
  }
}

export type UsageTotals = {
  calls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  avgLatencyMs: number;
};

export type ModelBreakdownRow = UsageTotals & { model: string; provider: string; label: string };
export type FeatureBreakdownRow = UsageTotals & { feature: string };
export type UserBreakdownRow = UsageTotals & { userId: string | null; email: string | null };
export type DailyPoint = { day: string; calls: number; costUsd: number };

const EMPTY_TOTALS: UsageTotals = {
  calls: 0,
  failedCalls: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  avgLatencyMs: 0,
};

/** Prisma's Decimal/BigInt aggregates need coaxing into plain numbers for the UI. */
function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value) || 0;
}

type RawRow = {
  key: string | null;
  provider?: string | null;
  calls: bigint;
  failed_calls: bigint;
  input_tokens: bigint | null;
  output_tokens: bigint | null;
  cost_usd: Prisma.Decimal | null;
  avg_latency: number | null;
};

function toTotals(row: RawRow): UsageTotals {
  return {
    calls: num(row.calls),
    failedCalls: num(row.failed_calls),
    inputTokens: num(row.input_tokens),
    outputTokens: num(row.output_tokens),
    costUsd: num(row.cost_usd),
    avgLatencyMs: Math.round(num(row.avg_latency)),
  };
}

/**
 * What tier routing actually bought. `savedUsd` is the difference between what
 * the served tokens cost and what those same tokens would have cost on the
 * strongest rung of each feature's ladder — the counterfactual the tiering
 * exists to beat.
 *
 * It is an estimate by construction: the expensive model would have produced a
 * different number of output tokens for the same prompt. It is still the right
 * number to show, because the alternative to tiering really is "send it all to
 * the big model", and no cheaper comparison exists.
 */
export type TierReport = {
  firstTryCalls: number;
  escalatedCalls: number;
  escalationRate: number;
  /** Share of successful calls served by a model that cost nothing. */
  freeShare: number;
  actualUsd: number;
  counterfactualUsd: number;
  savedUsd: number;
  byLadderPosition: {
    attempt: number;
    calls: number;
    failedCalls: number;
    costUsd: number;
  }[];
  avgComplexity: number | null;
};

export type UsageReport = {
  since: Date;
  overall: UsageTotals;
  byModel: ModelBreakdownRow[];
  byFeature: FeatureBreakdownRow[];
  byUser: UserBreakdownRow[];
  daily: DailyPoint[];
  tiers: TierReport;
  recentFailures: {
    id: string;
    model: string;
    feature: string;
    errorMessage: string | null;
    createdAt: Date;
  }[];
};

type AttemptRow = { attempt: number; calls: bigint; failed_calls: bigint; cost_usd: Prisma.Decimal | null };
type ServedRow = {
  feature: string;
  model: string;
  input_tokens: bigint | null;
  output_tokens: bigint | null;
  cost_usd: Prisma.Decimal | null;
  free_calls: bigint;
  calls: bigint;
  avg_complexity: number | null;
  scored_calls: bigint;
};

function buildTierReport(
  attemptRows: AttemptRow[],
  servedRows: ServedRow[],
  ladders: Record<AiFeature, string[]>,
): TierReport {
  const byLadderPosition = attemptRows.map((row) => ({
    attempt: row.attempt,
    calls: num(row.calls),
    failedCalls: num(row.failed_calls),
    costUsd: num(row.cost_usd),
  }));

  const firstTryCalls = byLadderPosition.find((r) => r.attempt === 1)?.calls ?? 0;
  const escalatedCalls = byLadderPosition
    .filter((r) => r.attempt > 1)
    .reduce((total, r) => total + r.calls, 0);
  const totalCalls = firstTryCalls + escalatedCalls;

  let actualUsd = 0;
  let counterfactualUsd = 0;
  let freeCalls = 0;
  let servedCalls = 0;
  let complexityWeighted = 0;
  let complexitySamples = 0;

  for (const row of servedRows) {
    const inputTokens = num(row.input_tokens);
    const outputTokens = num(row.output_tokens);
    const calls = num(row.calls);

    actualUsd += num(row.cost_usd);
    freeCalls += num(row.free_calls);
    servedCalls += calls;

    // Weight by the rows that actually carry a score, not by every row in the
    // group — AVG() skips NULLs, so rows written before tier routing existed
    // would otherwise inflate their group's weight.
    const scored = num(row.scored_calls);
    if (row.avg_complexity !== null && scored > 0) {
      complexityWeighted += row.avg_complexity * scored;
      complexitySamples += scored;
    }

    // Price the same tokens on the top rung of that feature's ladder. An
    // unknown feature or an empty ladder has no counterfactual, so it
    // contributes its actual cost and nothing is claimed as saved.
    const ladder = ladders[row.feature as AiFeature];
    const topRung = ladder?.length ? findModel(ladder[ladder.length - 1]) : undefined;
    counterfactualUsd += topRung
      ? inputTokens * topRung.inputPrice + outputTokens * topRung.outputPrice
      : num(row.cost_usd);
  }

  return {
    firstTryCalls,
    escalatedCalls,
    escalationRate: totalCalls > 0 ? escalatedCalls / totalCalls : 0,
    freeShare: servedCalls > 0 ? freeCalls / servedCalls : 0,
    actualUsd,
    counterfactualUsd,
    // Never negative: if the top rung was the one actually used, there was
    // nothing to save, and a rounding artefact should not read as a loss.
    savedUsd: Math.max(0, counterfactualUsd - actualUsd),
    byLadderPosition,
    avgComplexity: complexitySamples > 0 ? complexityWeighted / complexitySamples : null,
  };
}

/**
 * One report for the whole admin page. Aggregated in SQL rather than by
 * pulling rows into Node: this table grows by one row per model call, so the
 * "sum a month of usage" query has to stay something the database does.
 *
 * The five queries run sequentially, not in a Promise.all. Against a pooled
 * Postgres that would be the obvious speed-up, but this app's DATABASE_URL can
 * point at Supabase's direct (IPv6) host, which drops connections when several
 * are opened at once — a page that loads in 600ms beats one that intermittently
 * 500s.
 */
export async function getUsageReport(days: number): Promise<UsageReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const ladders = await getLadders();

  const overallRows = await prisma.$queryRaw<RawRow[]>`
    SELECT NULL::text AS key,
           COUNT(*) AS calls,
           COUNT(*) FILTER (WHERE NOT ok) AS failed_calls,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cost_usd) AS cost_usd,
           AVG(latency_ms) AS avg_latency
    FROM llm_usage
    WHERE created_at >= ${since}
  `;

  const modelRows = await prisma.$queryRaw<RawRow[]>`
    SELECT model AS key,
           provider,
           COUNT(*) AS calls,
           COUNT(*) FILTER (WHERE NOT ok) AS failed_calls,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cost_usd) AS cost_usd,
           AVG(latency_ms) AS avg_latency
    FROM llm_usage
    WHERE created_at >= ${since}
    GROUP BY model, provider
    ORDER BY SUM(cost_usd) DESC, COUNT(*) DESC
  `;

  const featureRows = await prisma.$queryRaw<RawRow[]>`
    SELECT feature AS key,
           COUNT(*) AS calls,
           COUNT(*) FILTER (WHERE NOT ok) AS failed_calls,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cost_usd) AS cost_usd,
           AVG(latency_ms) AS avg_latency
    FROM llm_usage
    WHERE created_at >= ${since}
    GROUP BY feature
    ORDER BY SUM(cost_usd) DESC, COUNT(*) DESC
  `;

  const userRows = await prisma.$queryRaw<RawRow[]>`
    SELECT user_id AS key,
           COUNT(*) AS calls,
           COUNT(*) FILTER (WHERE NOT ok) AS failed_calls,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cost_usd) AS cost_usd,
           AVG(latency_ms) AS avg_latency
    FROM llm_usage
    WHERE created_at >= ${since} AND user_id IS NOT NULL
    GROUP BY user_id
    ORDER BY SUM(cost_usd) DESC, COUNT(*) DESC
    LIMIT 50
  `;
  const users = await prisma.user.findMany({
    where: { id: { in: userRows.map((row) => row.key).filter((id): id is string => id !== null) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const dailyRows = await prisma.$queryRaw<{ day: Date; calls: bigint; cost_usd: Prisma.Decimal | null }[]>`
    SELECT date_trunc('day', created_at) AS day,
           COUNT(*) AS calls,
           SUM(cost_usd) AS cost_usd
    FROM llm_usage
    WHERE created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const attemptRows = await prisma.$queryRaw<
    { attempt: number; calls: bigint; failed_calls: bigint; cost_usd: Prisma.Decimal | null }[]
  >`
    SELECT attempt,
           COUNT(*) AS calls,
           COUNT(*) FILTER (WHERE NOT ok) AS failed_calls,
           SUM(cost_usd) AS cost_usd
    FROM llm_usage
    WHERE created_at >= ${since}
    GROUP BY attempt
    ORDER BY attempt ASC
  `;

  // Only successful calls carry tokens worth pricing a counterfactual against —
  // a failed rung produced nothing the expensive model would have had to match.
  const servedRows = await prisma.$queryRaw<
    {
      feature: string;
      model: string;
      input_tokens: bigint | null;
      output_tokens: bigint | null;
      cost_usd: Prisma.Decimal | null;
      free_calls: bigint;
      calls: bigint;
      avg_complexity: number | null;
      scored_calls: bigint;
    }[]
  >`
    SELECT feature,
           model,
           SUM(input_tokens) AS input_tokens,
           SUM(output_tokens) AS output_tokens,
           SUM(cost_usd) AS cost_usd,
           COUNT(*) FILTER (WHERE cost_usd = 0) AS free_calls,
           COUNT(*) AS calls,
           AVG(complexity) AS avg_complexity,
           COUNT(complexity) AS scored_calls
    FROM llm_usage
    WHERE created_at >= ${since} AND ok
    GROUP BY feature, model
  `;

  const recentFailures = await prisma.llmUsage.findMany({
    where: { ok: false, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, model: true, feature: true, errorMessage: true, createdAt: true },
  });

  return {
    since,
    overall: overallRows[0] ? toTotals(overallRows[0]) : EMPTY_TOTALS,
    byModel: modelRows.map((row) => ({
      ...toTotals(row),
      model: row.key ?? "unknown",
      provider: row.provider ?? "unknown",
      label: findModel(row.key ?? "")?.label ?? row.key ?? "unknown",
    })),
    byFeature: featureRows.map((row) => ({ ...toTotals(row), feature: row.key ?? "unknown" })),
    byUser: userRows.map((row) => ({
      ...toTotals(row),
      userId: row.key,
      email: row.key ? emailById.get(row.key) ?? null : null,
    })),
    tiers: buildTierReport(attemptRows, servedRows, ladders),
    daily: dailyRows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      calls: num(row.calls),
      costUsd: num(row.cost_usd),
    })),
    recentFailures,
  };
}
