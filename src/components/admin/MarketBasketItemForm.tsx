"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";

type ListingOption = { id: string; name: string; providerName: string };

export function MarketBasketItemForm({
  existingBasketNames,
  listings,
}: {
  existingBasketNames: string[];
  listings: ListingOption[];
}) {
  const router = useRouter();
  const [basketName, setBasketName] = useState(existingBasketNames[0] ?? "");
  const [label, setLabel] = useState("");
  const [listingId, setListingId] = useState("");
  const [weight, setWeight] = useState("1");
  const [basketNameError, setBasketNameError] = useState<string | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [listingError, setListingError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    setBasketNameError(null);
    setLabelError(null);
    setListingError(null);
    let hasError = false;
    if (!basketName.trim()) {
      setBasketNameError("Basket name is required");
      hasError = true;
    }
    if (!label.trim()) {
      setLabelError("Component label is required");
      hasError = true;
    }
    if (!listingId) {
      setListingError("Pick a listing");
      hasError = true;
    }
    if (hasError) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/market-basket-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketName: basketName.trim(),
          label: label.trim(),
          listingId,
          weight: Number(weight),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Could not add basket component");
        return;
      }
      setLabel("");
      setListingId("");
      setWeight("1");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">Add basket component</p>
      <p className="text-[12px] text-text-secondary">
        A basket is just a shared name across components — type an existing one to add to it, or a new one to start
        a new basket. Tracked over time on /regulator/price-index.
      </p>

      <FormField label="Basket name" error={basketNameError}>
        <Input
          list="existing-basket-names"
          placeholder="e.g. Consumer Price Basket"
          value={basketName}
          onChange={(e) => setBasketName(e.target.value)}
        />
        <datalist id="existing-basket-names">
          {existingBasketNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </FormField>

      <FormField label="Component label" error={labelError}>
        <Input placeholder="e.g. 10kg mealie-meal" value={label} onChange={(e) => setLabel(e.target.value)} />
      </FormField>

      <FormField label="Listing" error={listingError}>
        <select
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
        >
          <option value="">Select a listing…</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.providerName})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Weight">
        <Input type="number" min="0" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className="!w-24" />
      </FormField>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Adding…" : "Add to basket"}
      </Button>
    </Card>
  );
}
