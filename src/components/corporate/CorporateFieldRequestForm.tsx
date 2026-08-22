"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Category = { id: string; name: string; sector: { name: string } };

const DATA_TYPES = ["number", "string", "boolean", "enum"] as const;
const QUALITY_AXES = ["value", "trust", "availability", "performance", "resilience"] as const;

/**
 * Corporate's "Add field" request — proposes a brand-new comparable field
 * for one of its categories (see CorporateRequestType.new_field). Goes to a
 * regulator, then admin, before it can ever become consumer-visible; see
 * /regulator/field-proposals and /admin/corporate-requests.
 */
export function CorporateFieldRequestForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [consumerLabel, setConsumerLabel] = useState("");
  const [dataType, setDataType] = useState<(typeof DATA_TYPES)[number]>("number");
  const [unit, setUnit] = useState("");
  const [qualityAxis, setQualityAxis] = useState<(typeof QUALITY_AXES)[number] | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/corporate/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_field",
          categoryId,
          reason,
          proposedData: {
            key: key.trim(),
            label: label.trim(),
            consumerLabel: consumerLabel.trim() || null,
            dataType,
            unit: unit.trim() || null,
            qualityAxis: qualityAxis || null,
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Failed to submit");
        return;
      }
      router.push("/corporate/requests");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-[520px] space-y-3">
      <div>
        <h1 className="font-display text-[18px] font-bold">Propose a new field</h1>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Suggest a new comparable field for your category — a regulator and then Kuwana admin review it before it
          can appear to consumers.
        </p>
      </div>

      <label className="block text-[12px] font-medium text-text-secondary">
        Category
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.sector.name} / {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[12px] font-medium text-text-secondary">
        Field key (stable, snake_case)
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="nostro_fca_min_balance"
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px] font-mono"
        />
      </label>

      <label className="block text-[12px] font-medium text-text-secondary">
        Label (your terminology)
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nostro FCA Minimum Balance"
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
      </label>

      <label className="block text-[12px] font-medium text-text-secondary">
        Consumer-facing label (plain language, optional)
        <input
          value={consumerLabel}
          onChange={(e) => setConsumerLabel(e.target.value)}
          placeholder="Minimum USD account balance"
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-[12px] font-medium text-text-secondary">
          Type
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value as (typeof DATA_TYPES)[number])}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          >
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] font-medium text-text-secondary">
          Unit (optional)
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="USD"
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
        </label>
      </div>

      <label className="block text-[12px] font-medium text-text-secondary">
        Feeds which ranking axis? (optional)
        <select
          value={qualityAxis}
          onChange={(e) => setQualityAxis(e.target.value as (typeof QUALITY_AXES)[number] | "")}
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        >
          <option value="">None — display only</option>
          {QUALITY_AXES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[12px] font-medium text-text-secondary">
        Why this field?
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
      </label>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button
        onClick={submit}
        disabled={loading || !categoryId || !key.trim() || !label.trim() || !reason.trim()}
      >
        {loading ? "Submitting…" : "Submit for review"}
      </Button>
    </Card>
  );
}
