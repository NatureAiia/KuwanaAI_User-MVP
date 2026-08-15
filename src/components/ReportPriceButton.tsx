"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";

export function ReportPriceButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"sent" | "loggedOut" | "error" | null>(null);

  async function submit() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, description }),
      });
      if (res.status === 401) {
        setResult("loggedOut");
        return;
      }
      if (!res.ok) {
        setResult("error");
        return;
      }
      setResult("sent");
      setDescription("");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap-target mt-3 flex items-center gap-1.5 text-[12px] font-medium text-text-muted hover:text-accent-coral"
      >
        <Flag size={12} />
        Report this price
      </button>
    );
  }

  if (result === "sent") {
    return <p className="mt-3 text-[12.5px] text-accent-teal">Thanks — a regulator will review this.</p>;
  }

  if (result === "loggedOut") {
    return (
      <p className="mt-3 text-[12.5px] text-text-secondary">
        <Link href="/login" className="text-accent-sky hover:underline">
          Log in
        </Link>{" "}
        to report a price issue.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <TextArea
        rows={3}
        placeholder="What's wrong with this price? (e.g. price shown here doesn't match what the provider actually charges)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {result === "error" && <p className="text-[12px] text-accent-coral">Couldn&apos;t submit — try again.</p>}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={submit}
          disabled={saving || description.trim().length < 10}
          className="flex-1"
        >
          {saving ? "Sending…" : "Submit report"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
