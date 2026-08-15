"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";

type CategoryOption = { id: string; name: string; sector: { name: string } };

export function PriceCapRuleForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [capValue, setCapValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    const value = Number(capValue);
    if (!categoryId || !(value > 0)) {
      setError("Pick a category and a positive cap value");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/regulator/price-cap-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, capValue: value, currency }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Could not create price cap");
        return;
      }
      setCapValue("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (categories.length === 0) {
    return (
      <Card>
        <p className="font-display text-[14px] font-semibold">New price cap</p>
        <p className="mt-2 text-[12.5px] text-text-muted">No categories available yet.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">New gazetted price cap</p>
      <p className="text-[12px] text-text-secondary">
        Flags every published listing in the category priced above this ceiling, in the same currency.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FormField label="Category">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sector.name} / {c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Cap value">
          <Input type="number" min={0} step="0.01" placeholder="e.g. 15" value={capValue} onChange={(e) => setCapValue(e.target.value)} />
        </FormField>
        <FormField label="Currency">
          <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="!w-24" />
        </FormField>
      </div>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Saving…" : "Create price cap"}
      </Button>
    </Card>
  );
}
