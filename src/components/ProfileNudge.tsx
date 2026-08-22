"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AGE_RANGES } from "@/lib/onboarding-options";

const STORAGE_KEY_PREFIX = "kuwana_profile_nudge_next_at_";
// "Every now and then", not every visit — a skip pushes the next prompt out
// this far; a completed update pushes it out further still (SNOOZE_UPDATED_DAYS)
// since there's nothing left to chase for a while.
const SNOOZE_SKIPPED_DAYS = 14;
const SNOOZE_UPDATED_DAYS = 90;

type ProfileValues = { ageRange: string | null; occupation: string | null; location: string | null };

/**
 * Post-sign-in nudge to fill in the optional profile fields onboarding
 * left blank (age range/occupation/location) — sign-in itself is never
 * blocked or slowed by this; it's a dismissible card that shows up on the
 * next natural page load, at most every couple of weeks, never as a modal
 * that has to be dealt with before continuing. Lets the user update an
 * already-filled value too, not just fill a blank one — the same short form
 * either way, only the framing differs.
 */
export function ProfileNudge({ userId, profile }: { userId: string; profile: ProfileValues }) {
  const router = useRouter();
  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
  const missingCount = [profile.ageRange, profile.occupation, profile.location].filter((v) => !v).length;

  const [visible, setVisible] = useState(false);
  const [ageRange, setAgeRange] = useState(profile.ageRange ?? "");
  const [occupation, setOccupation] = useState(profile.occupation ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (missingCount === 0) return;
    const nextAt = Number(localStorage.getItem(storageKey) ?? "0");
    if (Date.now() < nextAt) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only cadence timer on mount, can't be known during SSR
    setVisible(true);
  }, [missingCount, storageKey]);

  function snooze(days: number) {
    localStorage.setItem(storageKey, String(Date.now() + days * 86_400_000));
    setVisible(false);
  }

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (ageRange) body.ageRange = ageRange;
      if (occupation.trim()) body.occupation = occupation.trim();
      if (location.trim()) body.location = location.trim();
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        snooze(SNOOZE_UPDATED_DAYS);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-accent-sky/30 bg-accent-sky/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-semibold text-text-primary">Help us tailor recommendations to you</p>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            A couple of quick details — update anything, skip whatever you&apos;d rather not share.
          </p>
        </div>
        <button
          onClick={() => snooze(SNOOZE_SKIPPED_DAYS)}
          aria-label="Skip"
          className="tap-target flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted hover:text-text-secondary"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">
          Age range
          <select
            value={ageRange}
            onChange={(e) => setAgeRange(e.target.value)}
            className="tap-target rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          >
            <option value="">Prefer not to say</option>
            {AGE_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">
          Occupation
          <input
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            placeholder="e.g. Teacher"
            className="tap-target rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] text-text-muted">
          Location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Harare"
            className="tap-target rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-1.5">
        <Button size="md" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="md" onClick={() => snooze(SNOOZE_SKIPPED_DAYS)} disabled={saving}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
