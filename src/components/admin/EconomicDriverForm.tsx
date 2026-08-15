"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";

function currentPeriod(): string {
  return `${new Date().toISOString().slice(0, 7)}-01`;
}

export function EconomicDriverForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [region, setRegion] = useState("ZW");
  const [value, setValue] = useState("");
  const [previousValue, setPreviousValue] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [currencyCode, setCurrencyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim() || !value.trim()) {
      setError("Name and value are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/economic-drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          region: region.trim() || "ZW",
          value: Number(value),
          previousValue: previousValue.trim() ? Number(previousValue) : undefined,
          period: new Date(period).toISOString(),
          currencyCode: currencyCode.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? JSON.stringify(data.error) : "Could not save economic driver");
        return;
      }
      setValue("");
      setPreviousValue("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">New / updated reading</p>
      <p className="text-[12px] text-text-secondary">
        Same name + region + period upserts in place — e.g. re-entering &ldquo;USD_ZIG_RATE&rdquo; for this month
        updates that month&apos;s reading instead of duplicating it.
      </p>

      <FormField label="Name">
        <Input
          placeholder="e.g. USD_ZIG_RATE, inflation_rate"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>

      <div className="flex gap-2">
        <FormField label="Region">
          <Input value={region} onChange={(e) => setRegion(e.target.value)} className="!w-24" />
        </FormField>
        <FormField label="Period">
          <Input type="date" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </FormField>
        <FormField label="Currency (optional)">
          <Input value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)} className="!w-32" />
        </FormField>
      </div>

      <div className="flex gap-2">
        <FormField label="Value">
          <Input type="number" step="0.0001" value={value} onChange={(e) => setValue(e.target.value)} />
        </FormField>
        <FormField label="Previous value (optional)">
          <Input type="number" step="0.0001" value={previousValue} onChange={(e) => setPreviousValue(e.target.value)} />
        </FormField>
      </div>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Saving…" : "Save reading"}
      </Button>
    </Card>
  );
}
