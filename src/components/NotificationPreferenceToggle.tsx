"use client";

import { useEffect, useState } from "react";

/** A single per-type in-app notification toggle, backed by /api/notifications/preferences. */
export function NotificationPreferenceToggle({
  type,
  label,
  description,
}: {
  type: string;
  label: string;
  description: string;
}) {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/notifications/preferences?types=${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setEnabled(data?.preferences?.[type] ?? true))
      .finally(() => setLoaded(true));
  }, [type]);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, enabled: next }),
    }).catch(() => {});
  }

  return (
    <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
      <input
        type="checkbox"
        checked={enabled}
        onChange={toggle}
        disabled={!loaded}
        className="mt-0.5 tap-target"
      />
      <span>
        <p className="text-[13.5px] font-medium">{label}</p>
        <p className="text-[12px] text-text-muted">{description}</p>
      </span>
    </label>
  );
}
