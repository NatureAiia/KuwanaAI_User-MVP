"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";

type Metric = "avg_price" | "listing_count" | "trending_down" | "trending_up";
type Direction = "above" | "below";

const METRIC_LABEL: Record<Metric, string> = {
  avg_price: "Average listing price",
  listing_count: "Published listing count",
  trending_down: "Listings trending down",
  trending_up: "Listings trending up",
};

export function AlertRuleForm() {
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>("avg_price");
  const [direction, setDirection] = useState<Direction>("below");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    const value = Number(threshold);
    if (!threshold.trim() || !(value > 0)) {
      setError("Enter a positive threshold");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/corporate/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric, direction, threshold: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Could not create alert");
        return;
      }
      setThreshold("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">New alert</p>
      <p className="text-[12px] text-text-secondary">
        Watches one of your own metrics and flags it here when the threshold is crossed.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FormField label="Metric">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
          >
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Direction">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
          >
            <option value="below">Drops below</option>
            <option value="above">Rises above</option>
          </select>
        </FormField>
        <FormField label="Threshold">
          <Input type="number" min={0} step="0.01" placeholder="e.g. 25" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </FormField>
      </div>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Saving…" : "Create alert"}
      </Button>
    </Card>
  );
}
