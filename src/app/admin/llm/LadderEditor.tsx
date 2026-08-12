"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Card";
import type { AiFeature, ModelSpec } from "@/lib/ai/models";

function pricePerMillion(price: number) {
  return price === 0 ? "free" : `$${(price * 1_000_000).toFixed(2)}`;
}

/**
 * Edits one feature's tier ladder: an ordered, cheapest-first list of models.
 * Rung 1 is where an easy request starts; a request the complexity heuristic
 * judges harder starts further down, and a rung that fails hands off to the
 * next one.
 */
export function LadderEditor({
  feature,
  label,
  blurb,
  ladder,
  models,
}: {
  feature: AiFeature;
  label: string;
  blurb: string;
  ladder: string[];
  models: ModelSpec[];
}) {
  const router = useRouter();
  const [rungs, setRungs] = useState<string[]>(ladder);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const specs = rungs.map((id) => models.find((m) => m.id === id)).filter((m): m is ModelSpec => !!m);
  const unused = models.filter((m) => !rungs.includes(m.id));

  async function persist(next: string[]) {
    setError(null);
    setSaved(false);
    const previous = rungs;
    setRungs(next);

    const response = await fetch("/api/admin/llm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature, ladder: next }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      // Put the ladder back — leaving it on the failed value would show a
      // configuration the server never accepted.
      setRungs(previous);
      setError(
        typeof body?.error === "string"
          ? body.error
          : "Could not save. Check you're still signed in as an admin.",
      );
      return;
    }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rungs.length) return;
    const next = [...rungs];
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  }

  function remove(index: number) {
    if (rungs.length === 1) {
      setError("A ladder needs at least one model.");
      return;
    }
    void persist(rungs.filter((_, i) => i !== index));
  }

  function add(modelId: string) {
    if (!modelId) return;
    void persist([...rungs, modelId]);
  }

  return (
    <div className="border-border bg-bg-surface rounded-[var(--radius-card)] border p-4">
      <p className="font-display text-[15px] font-semibold">{label}</p>
      <p className="text-text-secondary mt-1 text-[12.5px]">{blurb}</p>

      <ol className="mt-3 flex flex-col gap-2">
        {specs.map((spec, index) => (
          <li
            key={spec.id}
            className="border-border bg-bg-surface-raised flex flex-wrap items-center gap-2 rounded-[var(--radius-input)] border px-3 py-2"
          >
            <span className="text-text-muted w-4 shrink-0 font-mono text-[11px]">{index + 1}</span>
            <span className="min-w-0 flex-1 text-[12.5px] font-medium">{spec.label}</span>
            <Badge tone={spec.provider === "anthropic" ? "sky" : "teal"}>{spec.provider}</Badge>
            <span className="text-text-muted font-mono text-[10.5px]">
              {pricePerMillion(spec.inputPrice)} / {pricePerMillion(spec.outputPrice)}
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                aria-label={`Move ${spec.label} up`}
                disabled={pending || index === 0}
                onClick={() => move(index, -1)}
                className="border-border rounded border px-1.5 text-[11px] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${spec.label} down`}
                disabled={pending || index === specs.length - 1}
                onClick={() => move(index, 1)}
                className="border-border rounded border px-1.5 text-[11px] disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${spec.label}`}
                disabled={pending || specs.length === 1}
                onClick={() => remove(index)}
                className="border-border text-accent-coral rounded border px-1.5 text-[11px] disabled:opacity-30"
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ol>

      {unused.length > 0 && (
        <label className="mt-2 block">
          <span className="text-text-muted text-[11px]">Add a rung</span>
          <select
            className="border-border bg-bg-surface-raised mt-1 w-full rounded-[var(--radius-input)] border px-3 py-2 text-[12.5px]"
            value=""
            disabled={pending}
            onChange={(event) => add(event.target.value)}
          >
            <option value="">Select a model…</option>
            {unused.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} — in {pricePerMillion(model.inputPrice)} / out{" "}
                {pricePerMillion(model.outputPrice)} per 1M
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="text-text-muted mt-2 text-[11.5px]">
        Rung 1 handles easy requests. Harder ones start lower down, and a rung that fails hands off to
        the next.
        {/* Chat is the only feature that can be sent an image, so it is the only
            one where a text-only ladder silently degrades a real path. */}
        {feature === "chat" && !specs.some((s) => s.vision) && (
          <span className="text-accent-coral">
            {" "}
            No rung here can read images — attachments will be described in text instead.
          </span>
        )}
      </p>

      {error && <p className="text-accent-coral mt-2 text-[11.5px]">{error}</p>}
      {saved && !error && <p className="text-accent-teal mt-2 text-[11.5px]">Saved.</p>}
    </div>
  );
}
