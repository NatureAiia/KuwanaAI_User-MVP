"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Card";
import type { AiFeature, ModelSpec } from "@/lib/ai/models";

function pricePerMillion(price: number) {
  if (price === 0) return "free";
  return `$${(price * 1_000_000).toFixed(2)}`;
}

export function ModelPicker({
  feature,
  label,
  blurb,
  current,
  models,
}: {
  feature: AiFeature;
  label: string;
  blurb: string;
  current: string;
  models: ModelSpec[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const spec = models.find((m) => m.id === selected);

  async function save(modelId: string) {
    setError(null);
    setSaved(false);
    const previous = selected;
    setSelected(modelId);

    const response = await fetch("/api/admin/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, modelId }),
    });

    if (!response.ok) {
      // Put the select back where it was — leaving it on the failed value
      // would show a selection the server never accepted.
      setSelected(previous);
      setError("Could not save. Check you're still signed in as an admin.");
      return;
    }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <div className="border-border bg-bg-surface rounded-[var(--radius-card)] border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-[15px] font-semibold">{label}</p>
        {spec && (
          <Badge tone={spec.provider === "anthropic" ? "sky" : "teal"}>{spec.provider}</Badge>
        )}
      </div>
      <p className="text-text-secondary mt-1 text-[12.5px]">{blurb}</p>

      <label className="mt-3 block">
        <span className="text-text-muted text-[11px]">Model</span>
        <select
          className="border-border bg-bg-surface-raised mt-1 w-full rounded-[var(--radius-input)] border px-3 py-2 text-[13px]"
          value={selected}
          disabled={pending}
          onChange={(event) => void save(event.target.value)}
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} — in {pricePerMillion(model.inputPrice)} / out{" "}
              {pricePerMillion(model.outputPrice)} per 1M
            </option>
          ))}
        </select>
      </label>

      {spec && (
        <p className="text-text-muted mt-2 text-[11.5px]">
          {spec.contextWindow.toLocaleString()} token context
          {spec.vision ? " · reads images" : " · text only"}
          {spec.note ? ` · ${spec.note}` : ""}
        </p>
      )}

      {/* Chat is the only feature that can be sent an image, so it is the only
          one where picking a text-only model silently degrades a real path. */}
      {feature === "chat" && spec && !spec.vision && (
        <p className="text-accent-coral mt-2 text-[11.5px]">
          This model cannot read images. Attachments will be described to it in text instead.
        </p>
      )}

      {error && <p className="text-accent-coral mt-2 text-[11.5px]">{error}</p>}
      {saved && !error && <p className="text-accent-teal mt-2 text-[11.5px]">Saved.</p>}
    </div>
  );
}
