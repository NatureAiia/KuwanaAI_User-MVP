import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findModel, type AiFeature, type ModelSpec } from "./models";

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

export type UsageReport = {
  since: Date;
  overall: UsageTotals;
  byModel: ModelBreakdownRow[];
  byFeature: FeatureBreakdownRow[];
  daily: DailyPoint[];
  recentFailures: {
    id: string;
    model: string;
    feature: string;
    errorMessage: string | null;
    createdAt: Date;
  }[];
};

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

  const dailyRows = await prisma.$queryRaw<{ day: Date; calls: bigint; cost_usd: Prisma.Decimal | null }[]>`
    SELECT date_trunc('day', created_at) AS day,
           COUNT(*) AS calls,
           SUM(cost_usd) AS cost_usd
    FROM llm_usage
    WHERE created_at >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
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
    daily: dailyRows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      calls: num(row.calls),
      costUsd: num(row.cost_usd),
    })),
    recentFailures,
  };
}
