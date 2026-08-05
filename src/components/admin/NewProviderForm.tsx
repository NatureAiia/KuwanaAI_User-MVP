"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function NewProviderForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [verified, setVerified] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, verified, ...(logoUrl ? { logoUrl } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Failed to create provider");
        return;
      }
      setName("");
      setLogoUrl("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-2.5">
        <p className="font-display text-[14px] font-semibold">New provider</p>

        <input
          required
          placeholder="Provider name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        <input
          placeholder="Logo URL (optional)"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        <label className="flex items-center gap-2 text-[13px] text-text-secondary">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          Verified provider
        </label>

        {error && <p className="text-[12px] text-accent-coral">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full justify-center">
          {loading ? "Creating…" : "Create provider"}
        </Button>

        <p className="text-[11.5px] text-text-muted">
          Providers can&apos;t be deleted here — removing one would cascade-delete all of its
          listings.
        </p>
      </Card>
    </form>
  );
}
