import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Card, Badge } from "@/components/ui/Card";
import { getUsageReport, type UsageTotals } from "@/lib/ai/usage";
import { getLadders } from "@/lib/ai/modelConfig";
import {
  AI_FEATURES,
  AI_FEATURE_BLURBS,
  AI_FEATURE_LABELS,
  MODEL_CATALOG,
  type AiFeature,
} from "@/lib/ai/models";
import { LadderEditor } from "./LadderEditor";

// Usage rows are written on every model call, so a cached render would show an
// admin stale spend the moment anyone uses the app.
export const dynamic = "force-dynamic";

const RANGES = [
  { days: 1, label: "24h" },
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

function money(value: number) {
  if (value === 0) return "$0.00";
  // Sub-cent totals are the normal case on free/cheap models — rounding them
  // to $0.00 would make a working integration look like it never ran.
  if (value < 0.01) return `$${value.toFixed(5)}`;
  return `$${value.toFixed(2)}`;
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card>
      <p className="text-text-muted text-[11px]">{label}</p>
      <p className={`mt-1 font-mono text-[22px] font-semibold ${tone ?? ""}`}>{value}</p>
      {sub && <p className="text-text-muted text-[10.5px]">{sub}</p>}
    </Card>
  );
}

function TotalsRow({ totals }: { totals: UsageTotals }) {
  return (
    <>
      <td className="py-2 text-right font-mono">{compact(totals.calls)}</td>
      <td className="py-2 text-right font-mono">
        {totals.failedCalls > 0 ? (
          <span className="text-accent-coral">{compact(totals.failedCalls)}</span>
        ) : (
          "0"
        )}
      </td>
      <td className="py-2 text-right font-mono">{compact(totals.inputTokens)}</td>
      <td className="py-2 text-right font-mono">{compact(totals.outputTokens)}</td>
      <td className="py-2 text-right font-mono">{totals.avgLatencyMs.toLocaleString()}ms</td>
      <td className="py-2 text-right font-mono">{money(totals.costUsd)}</td>
    </>
  );
}

export default async function AdminLlmPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const { range } = await searchParams;
  const days = RANGES.find((r) => String(r.days) === range)?.days ?? 7;

  const [report, ladders] = await Promise.all([getUsageReport(days), getLadders()]);

  const peakDay = report.daily.reduce<{ day: string; costUsd: number } | null>(
    (best, point) => (best === null || point.costUsd > best.costUsd ? point : best),
    null,
  );
  const maxDailyCost = Math.max(...report.daily.map((p) => p.costUsd), 0);

  return (
    <div className="mx-auto max-w-[860px] px-5 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold">AI models &amp; cost</h1>
          <p className="text-text-secondary mt-1 text-[13px]">
            Signed in as {admin.email} · <Link href="/admin" className="underline">back to admin</Link>
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/admin/llm?range=${r.days}`}
              className={`rounded-full border px-3 py-1 text-[12px] ${
                r.days === days
                  ? "border-accent-sky/40 bg-accent-sky/15 text-accent-sky"
                  : "border-border text-text-secondary"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <section className="mt-6">
        <h2 className="font-display text-text-secondary text-[14px] font-semibold">
          Last {days} day{days === 1 ? "" : "s"}
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total cost" value={money(report.overall.costUsd)} tone="text-accent-teal" />
          <StatCard
            label="Calls"
            value={compact(report.overall.calls)}
            sub={`${compact(report.overall.failedCalls)} failed`}
          />
          <StatCard
            label="Tokens"
            value={compact(report.overall.inputTokens + report.overall.outputTokens)}
            sub={`${compact(report.overall.inputTokens)} in / ${compact(report.overall.outputTokens)} out`}
          />
          <StatCard label="Avg latency" value={`${report.overall.avgLatencyMs.toLocaleString()}ms`} />
        </div>
        {report.overall.calls === 0 && (
          <p className="text-text-muted mt-2 text-[12px]">
            No model calls recorded in this window. Usage starts appearing here as soon as anyone uses
            chat, a compare recommendation, or need intake.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-text-secondary text-[14px] font-semibold">Tier routing</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Saved vs top rung"
            value={money(report.tiers.savedUsd)}
            sub={`${money(report.tiers.actualUsd)} spent vs ${money(report.tiers.counterfactualUsd)}`}
            tone="text-accent-teal"
          />
          <StatCard
            label="Served free"
            value={`${Math.round(report.tiers.freeShare * 100)}%`}
            sub="of successful calls"
          />
          <StatCard
            label="Escalated"
            value={`${Math.round(report.tiers.escalationRate * 100)}%`}
            sub={`${compact(report.tiers.escalatedCalls)} of ${compact(
              report.tiers.firstTryCalls + report.tiers.escalatedCalls,
            )} attempts`}
            tone={report.tiers.escalationRate > 0.25 ? "text-accent-coral" : undefined}
          />
          <StatCard
            label="Avg complexity"
            value={
              report.tiers.avgComplexity === null ? "—" : report.tiers.avgComplexity.toFixed(2)
            }
            sub="0 = trivial, 1 = hardest"
          />
        </div>

        {report.tiers.byLadderPosition.length > 0 && (
          <Card className="mt-3">
            <p className="text-text-muted text-[11px]">Attempts by ladder position</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {report.tiers.byLadderPosition.map((row) => (
                <div key={row.attempt} className="flex items-center gap-2 text-[11.5px]">
                  <span className="text-text-muted w-[72px] shrink-0">
                    {row.attempt === 1 ? "First try" : `Escalation ${row.attempt - 1}`}
                  </span>
                  <div className="bg-bg-surface-raised h-3 flex-1 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${row.attempt === 1 ? "bg-accent-teal" : "bg-accent-sky"}`}
                      style={{
                        width: `${Math.max(
                          2,
                          (row.calls /
                            Math.max(
                              1,
                              report.tiers.firstTryCalls + report.tiers.escalatedCalls,
                            )) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="w-[56px] shrink-0 text-right font-mono">{compact(row.calls)}</span>
                  <span className="w-[64px] shrink-0 text-right font-mono">
                    {row.failedCalls > 0 ? (
                      <span className="text-accent-coral">{compact(row.failedCalls)} failed</span>
                    ) : (
                      ""
                    )}
                  </span>
                  <span className="w-[84px] shrink-0 text-right font-mono">{money(row.costUsd)}</span>
                </div>
              ))}
            </div>
            <p className="text-text-muted mt-3 text-[11.5px]">
              &ldquo;Saved&rdquo; prices the tokens that were actually served against the top rung of
              each feature&rsquo;s ladder. It is an estimate — the bigger model would have produced a
              different number of output tokens — but &ldquo;send everything to the big model&rdquo; is
              the real alternative to tiering, so it is the right comparison.
            </p>
          </Card>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-text-secondary text-[14px] font-semibold">Tier ladder per feature</h2>
        <p className="text-text-muted mt-1 text-[12px]">
          Ordered cheapest-first. Changes apply to new requests within 30 seconds and are recorded in
          the audit log.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {AI_FEATURES.map((feature: AiFeature) => (
            <LadderEditor
              key={feature}
              feature={feature}
              label={AI_FEATURE_LABELS[feature]}
              blurb={AI_FEATURE_BLURBS[feature]}
              ladder={ladders[feature]}
              models={MODEL_CATALOG}
            />
          ))}
        </div>
      </section>

      {report.daily.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-text-secondary text-[14px] font-semibold">Daily spend</h2>
          <Card className="mt-2">
            {/* A bar per day rather than a chart library: the point is "which
                day was expensive", which a proportional bar answers directly. */}
            <div className="flex flex-col gap-1.5">
              {report.daily.map((point) => (
                <div key={point.day} className="flex items-center gap-2 text-[11.5px]">
                  <span className="text-text-muted w-[76px] shrink-0 font-mono">{point.day}</span>
                  <div className="bg-bg-surface-raised h-3 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-accent-teal h-full rounded-full"
                      style={{
                        width: maxDailyCost > 0 ? `${Math.max(2, (point.costUsd / maxDailyCost) * 100)}%` : "2%",
                      }}
                    />
                  </div>
                  <span className="w-[92px] shrink-0 text-right font-mono">{money(point.costUsd)}</span>
                  <span className="text-text-muted w-[64px] shrink-0 text-right font-mono">
                    {compact(point.calls)}
                  </span>
                </div>
              ))}
            </div>
            {peakDay && (
              <p className="text-text-muted mt-3 text-[11.5px]">
                Most expensive day: {peakDay.day} at {money(peakDay.costUsd)}.
              </p>
            )}
          </Card>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-text-secondary text-[14px] font-semibold">By model</h2>
        <Card className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead className="text-text-muted border-border border-b text-[11px]">
              <tr>
                <th className="py-2 text-left font-medium">Model</th>
                <th className="py-2 text-right font-medium">Calls</th>
                <th className="py-2 text-right font-medium">Failed</th>
                <th className="py-2 text-right font-medium">In</th>
                <th className="py-2 text-right font-medium">Out</th>
                <th className="py-2 text-right font-medium">Avg</th>
                <th className="py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {report.byModel.map((row) => (
                <tr key={row.model} className="border-border/60 border-b last:border-0">
                  <td className="py-2">
                    <span className="font-medium">{row.label}</span>
                    <span className="text-text-muted ml-2 text-[10.5px]">{row.provider}</span>
                  </td>
                  <TotalsRow totals={row} />
                </tr>
              ))}
              {report.byModel.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-text-muted py-3">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-text-secondary text-[14px] font-semibold">By feature</h2>
        <Card className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead className="text-text-muted border-border border-b text-[11px]">
              <tr>
                <th className="py-2 text-left font-medium">Feature</th>
                <th className="py-2 text-right font-medium">Calls</th>
                <th className="py-2 text-right font-medium">Failed</th>
                <th className="py-2 text-right font-medium">In</th>
                <th className="py-2 text-right font-medium">Out</th>
                <th className="py-2 text-right font-medium">Avg</th>
                <th className="py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {report.byFeature.map((row) => (
                <tr key={row.feature} className="border-border/60 border-b last:border-0">
                  <td className="py-2 font-medium">
                    {AI_FEATURE_LABELS[row.feature as AiFeature] ?? row.feature}
                  </td>
                  <TotalsRow totals={row} />
                </tr>
              ))}
              {report.byFeature.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-text-muted py-3">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      {report.recentFailures.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-text-secondary text-[14px] font-semibold">Recent failures</h2>
          <Card className="mt-2">
            <ul className="flex flex-col gap-2">
              {report.recentFailures.map((failure) => (
                <li key={failure.id} className="border-border/60 border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="coral">{failure.feature}</Badge>
                    <span className="text-text-muted font-mono text-[11px]">{failure.model}</span>
                    <span className="text-text-muted text-[11px]">
                      {failure.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                    </span>
                  </div>
                  <p className="text-text-secondary mt-1 font-mono text-[11.5px] break-words">
                    {failure.errorMessage ?? "no message"}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
