"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notifyGamification } from "@/lib/gamification/client";

export function ListingActions({
  listingId,
  sourceUrl,
  providerName,
  initialSaved,
}: {
  listingId: string;
  sourceUrl: string | null;
  providerName: string;
  initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved ?? false);
  const [saving, setSaving] = useState(false);

  async function toggleSave() {
    setSaving(true);
    const method = saved ? "DELETE" : "POST";
    const res = await fetch("/api/saved", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(!saved);
      if (!saved) notifyGamification((await res.json())?.gamification);
    }
  }

  async function takeAction() {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "action_taken", metadata: { listingId } }),
    }).catch(() => null);
    if (res?.ok) notifyGamification((await res.json())?.gamification);
  }

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Button variant="secondary" onClick={toggleSave} disabled={saving} className="flex-1">
        {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
        {saved ? "In your list" : "Add to list"}
      </Button>
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={takeAction} className="flex-1">
          <Button className="w-full">
            <ExternalLink size={16} />
            Go to {providerName}
          </Button>
        </a>
      ) : (
        <Button onClick={takeAction} className="flex-1">
          Dial *123# or visit {providerName} to sign up
        </Button>
      )}
    </div>
  );
}
