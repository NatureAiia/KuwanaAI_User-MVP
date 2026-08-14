"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type CategoryOption = { id: string; name: string; sector: { name: string } };
type ListingOption = { id: string; name: string; providerId: string; categoryId: string };
type ProviderOption = { id: string; name: string };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DiscountRuleForm({
  providers,
  categories,
  listings,
}: {
  providers: ProviderOption[];
  categories: CategoryOption[];
  listings: ListingOption[];
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [scope, setScope] = useState<"category" | "listing">("category");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [listingId, setListingId] = useState("");
  const [percentOff, setPercentOff] = useState("10");
  const [startsAt, setStartsAt] = useState(todayIsoDate());
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const providerListings = useMemo(
    () => listings.filter((l) => l.providerId === providerId),
    [listings, providerId],
  );

  async function submit() {
    setError(null);
    if (scope === "listing" && !listingId) {
      setError("Pick a listing for a listing-scoped discount");
      return;
    }
    if (!endsAt) {
      setError("Pick an end date");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/discount-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          scope,
          categoryId: scope === "category" ? categoryId : undefined,
          listingId: scope === "listing" ? listingId : undefined,
          percentOff: Number(percentOff),
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Could not create discount rule");
        return;
      }
      setPercentOff("10");
      setEndsAt("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (providers.length === 0) {
    return (
      <Card>
        <p className="font-display text-[14px] font-semibold">New discount rule</p>
        <p className="mt-2 text-[12.5px] text-text-muted">Add a provider before creating a discount.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">New discount rule</p>

      <select
        value={providerId}
        onChange={(e) => setProviderId(e.target.value)}
        className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
      >
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setScope("category")}
          className={`tap-target flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${
            scope === "category" ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          Whole category
        </button>
        <button
          type="button"
          onClick={() => setScope("listing")}
          className={`tap-target flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${
            scope === "listing" ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border text-text-secondary"
          }`}
        >
          Single listing
        </button>
      </div>

      {scope === "category" ? (
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.sector.name} / {c.name}
            </option>
          ))}
        </select>
      ) : (
        <select
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        >
          <option value="">Select a listing…</option>
          {providerListings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={percentOff}
          onChange={(e) => setPercentOff(e.target.value)}
          placeholder="% off"
          className="tap-target w-24 rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        <input
          type="date"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        <input
          type="date"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
      </div>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Creating…" : "Create discount rule"}
      </Button>
    </Card>
  );
}
