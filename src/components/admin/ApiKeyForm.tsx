"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Field";
import { BI_SCOPES, BI_SCOPE_LABELS, type BiScope } from "@/lib/bi/scopes";

type ProviderOption = { id: string; name: string };

export function ApiKeyForm({ providers }: { providers: ProviderOption[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [providerId, setProviderId] = useState("");
  const [scopes, setScopes] = useState<BiScope[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: BiScope) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function submit() {
    setError(null);
    if (!label.trim()) return setError("Label is required");
    if (scopes.length === 0) return setError("Pick at least one scope");
    if (scopes.includes("read:account") && !providerId) {
      return setError("read:account requires linking this key to a provider");
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), providerId: providerId || undefined, scopes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? JSON.stringify(data.error) : "Could not create key");
        return;
      }
      setCreatedKey(data.plaintextKey);
    } finally {
      setSaving(false);
    }
  }

  function copyKey() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function done() {
    setCreatedKey(null);
    setLabel("");
    setProviderId("");
    setScopes([]);
    router.refresh();
  }

  if (createdKey) {
    return (
      <Card className="space-y-3 border-accent-teal/40 bg-accent-teal/5">
        <p className="font-display text-[14px] font-semibold">Key created</p>
        <p className="text-[12.5px] text-text-secondary">
          Copy this now — it won&apos;t be shown again. Only its hash is stored.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface p-2.5">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-[12.5px]">{createdKey}</code>
          <button
            type="button"
            onClick={copyKey}
            aria-label="Copy key"
            className="tap-target shrink-0 rounded-md border border-border p-1.5 text-text-secondary hover:text-accent-teal"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <Button onClick={done} className="w-full justify-center">
          Done
        </Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-2.5">
      <p className="font-display text-[14px] font-semibold">Create an API key</p>
      <p className="text-[12px] text-text-secondary">
        Read-only access for external BI tools (Power BI, Tableau, etc.) — see /api/bi/v1/*.
      </p>

      <FormField label="Label">
        <Input placeholder="e.g. Econet BI dashboard" value={label} onChange={(e) => setLabel(e.target.value)} />
      </FormField>

      <FormField label="Linked provider (optional — leave blank for a platform-wide key)">
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-surface p-2.5 text-[13.5px]"
        >
          <option value="">Platform-wide</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Scopes">
        <div className="mt-1 flex flex-col gap-1.5">
          {BI_SCOPES.map((scope) => (
            <label key={scope} className="flex items-start gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() => toggleScope(scope)}
                className="mt-0.5 tap-target"
              />
              <span>
                <span className="font-medium">{scope}</span> — {BI_SCOPE_LABELS[scope]}
              </span>
            </label>
          ))}
        </div>
      </FormField>

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      <Button onClick={submit} disabled={saving} className="w-full justify-center">
        {saving ? "Creating…" : "Create key"}
      </Button>
    </Card>
  );
}
