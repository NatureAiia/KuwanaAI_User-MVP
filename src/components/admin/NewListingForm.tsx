"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AttributeFieldsEditor, attributeValuesToTyped } from "@/components/attributes/AttributeFieldsEditor";
import type { AttributeField } from "@/components/provider/types";

type CategoryOption = { id: string; name: string; sector: { name: string }; attributeSchema: AttributeField[] };
type ProviderOption = { id: string; name: string };

export function NewListingForm({
  categories,
  providers,
}: {
  categories: CategoryOption[];
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sourceUrl, setSourceUrl] = useState("");
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const attributes = attributeValuesToTyped(category?.attributeSchema ?? [], attributeValues);

    setLoading(true);
    try {
      const res = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          providerId,
          name,
          price: Number(price),
          currency,
          attributes,
          ...(sourceUrl ? { sourceUrl } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : `Failed to create listing — server returned ${res.status}`);
        return;
      }
      setName("");
      setPrice("");
      setSourceUrl("");
      setAttributeValues({});
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (categories.length === 0 || providers.length === 0) {
    return (
      <Card>
        <p className="font-display text-[14px] font-semibold">New listing</p>
        <p className="mt-2 text-[12.5px] text-text-muted">
          Add at least one provider before creating a listing.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">New listing</p>

      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setAttributeValues({});
        }}
        className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.sector.name} / {c.name}
          </option>
        ))}
      </select>

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

      <input
        required
        placeholder="Listing name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
      />

      <div className="flex gap-2">
        <input
          required
          type="number"
          step="0.01"
          min="0"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="tap-target w-24 rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
        />
      </div>

      <input
        placeholder="Source URL (optional)"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
      />

      <AttributeFieldsEditor
        fields={category?.attributeSchema ?? []}
        values={attributeValues}
        onChange={(key, value) => setAttributeValues((prev) => ({ ...prev, [key]: value }))}
      />

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button type="submit" disabled={loading} className="w-full justify-center">
        {loading ? "Creating…" : "Create listing"}
      </Button>
    </Card>
    </form>
  );
}
