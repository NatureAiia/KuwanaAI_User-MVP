"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField, Input, TextArea } from "@/components/ui/Field";
import { ProviderLogo } from "@/components/ProviderLogo";

// Same plain-controlled-input pattern as admin/NewProviderForm.tsx — no
// upload flow exists for logoUrl anywhere in this app, just a URL field.
export function CompanyProfileForm({
  initialName,
  initialLogoUrl,
  initialDescription,
}: {
  initialName: string;
  initialLogoUrl: string | null;
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNameError(null);
    setSaved(false);
    if (!name.trim()) {
      setNameError("Company name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/corporate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          logoUrl: logoUrl.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Failed to save changes");
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="max-w-[520px] space-y-3">
        <div className="flex items-center gap-3">
          <ProviderLogo name={name || initialName} logoUrl={logoUrl || null} size={40} />
          <p className="text-[12.5px] text-text-secondary">Shown to shoppers on every one of your listings.</p>
        </div>

        <FormField label="Company name" error={nameError}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <FormField label="Logo URL">
          <Input placeholder="https://…" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </FormField>

        <FormField label="Description">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="What CBZ Bank Limited offers, who it's for…"
          />
        </FormField>

        {error && <p className="text-[12px] text-accent-coral">{error}</p>}
        {saved && !error && <p className="text-[12px] text-accent-teal">Saved.</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </Card>
    </form>
  );
}
