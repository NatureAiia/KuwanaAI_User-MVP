"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, TextArea, FormField } from "@/components/ui/Field";
import { LIVE_SECTORS, SECTORS } from "@/lib/sectors";

type Category = "regulatory" | "competitor" | "macro";
type RiskLevel = "low" | "medium" | "high";

export function BusinessConditionForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("regulatory");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [sectorSlug, setSectorSlug] = useState("");
  const [reviewCycleDays, setReviewCycleDays] = useState("");
  const [notes, setNotes] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setTitleError(null);
    if (!title.trim()) {
      setTitleError("Title is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/business-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          riskLevel,
          sectorSlug: sectorSlug || undefined,
          reviewCycleDays: reviewCycleDays.trim() ? Number(reviewCycleDays) : undefined,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Could not save condition");
        return;
      }
      setTitle("");
      setNotes("");
      setReviewCycleDays("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">Track a new condition</p>
      <p className="text-[12px] text-text-secondary">
        A regulatory change, competitor move, or macro trigger worth watching — surfaced read-only on the
        regulator and corporate dashboards.
      </p>

      <FormField label="Title" error={titleError}>
        <Input placeholder="e.g. RBZ mandatory FX disclosure rule" value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <FormField label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
          >
            <option value="regulatory">Regulatory</option>
            <option value="competitor">Competitor</option>
            <option value="macro">Macro</option>
          </select>
        </FormField>
        <FormField label="Risk level">
          <select
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </FormField>
        <FormField label="Sector (optional)">
          <select
            value={sectorSlug}
            onChange={(e) => setSectorSlug(e.target.value)}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
          >
            <option value="">All sectors</option>
            {LIVE_SECTORS.map((slug) => (
              <option key={slug} value={slug}>
                {SECTORS[slug].name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Review cycle (days)">
          <Input
            type="number"
            min={1}
            placeholder="e.g. 90"
            value={reviewCycleDays}
            onChange={(e) => setReviewCycleDays(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Notes (optional)">
        <TextArea rows={3} placeholder="Internal context for reviewers" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Saving…" : "Track condition"}
      </Button>
    </Card>
  );
}
