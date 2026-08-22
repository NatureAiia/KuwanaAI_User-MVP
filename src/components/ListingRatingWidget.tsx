"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/Button";
import { notifyGamification } from "@/lib/gamification/client";
import { QUALITY_AXES } from "@/lib/bci";
import type { QualityAxis } from "@prisma/client";

const AXIS_LABELS: Record<QualityAxis, string> = {
  value: "Value for money",
  trust: "Trust & safety",
  availability: "Availability",
  performance: "Performance",
  resilience: "Resilience",
};

/**
 * The subjective-input side of the BCI ranking engine (src/lib/bci.ts) —
 * lets a signed-in consumer rate 1-5 on any of the 5 axes for this listing.
 * Not required to fill every axis; whichever ones they rate get upserted
 * (POST /api/listings/[id]/ratings), re-submitting just updates the same
 * row rather than creating a new one. Anonymous visitors see a sign-in
 * prompt instead of the form — rating requires knowing who's rating.
 */
export function ListingRatingWidget({
  listingId,
  isSignedIn,
  existingRatings,
}: {
  listingId: string;
  isSignedIn: boolean;
  existingRatings: Partial<Record<QualityAxis, number>>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Partial<Record<QualityAxis, number>>>(existingRatings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (Object.keys(draft).length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: draft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? "Couldn't save your rating." : "Something went wrong.");
        return;
      }
      const data = await res.json();
      notifyGamification(data.gamification);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!isSignedIn) {
    return (
      <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
        <h2 className="font-display text-[15px] font-semibold">Rate this listing</h2>
        <p className="mt-1.5 text-[13px] text-text-secondary">
          <a href="/login" className="font-semibold text-accent-sky hover:underline">
            Sign in
          </a>{" "}
          to share what you think — it feeds directly into how this listing ranks for other people.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
      <h2 className="font-display text-[15px] font-semibold">Rate this listing</h2>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Rate whichever of these actually matter to you — your ratings blend with real data to rank this listing for
        everyone.
      </p>

      <div className="mt-3 flex flex-col gap-2.5">
        {QUALITY_AXES.map((axis) => (
          <div key={axis} className="flex items-center justify-between gap-2">
            <span className="text-[13px] text-text-secondary">{AXIS_LABELS[axis]}</span>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${AXIS_LABELS[axis]}: ${n} out of 5`}
                  onClick={() => {
                    setSaved(false);
                    setDraft((prev) => ({ ...prev, [axis]: n }));
                  }}
                  className="tap-target flex h-7 w-7 items-center justify-center"
                >
                  <Star
                    size={16}
                    className={clsx(
                      (draft[axis] ?? 0) >= n ? "fill-accent-sky text-accent-sky" : "text-border",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-[12px] text-accent-coral">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <Button size="md" onClick={submit} disabled={saving || Object.keys(draft).length === 0}>
          {saving ? "Saving…" : "Submit rating"}
        </Button>
        {saved && <span className="text-[12px] font-medium text-accent-teal">Saved — thank you</span>}
      </div>
    </div>
  );
}
