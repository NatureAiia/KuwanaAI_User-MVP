"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, X } from "lucide-react";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type CategoryOption = { id: string; name: string; sector: { name: string } };
type ProviderOption = { id: string; name: string };

export type ExtractedFields = {
  name?: string;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  attributes?: Record<string, unknown>;
  provider_name_guess?: string | null;
};

export function ScrapedItemReview({
  item,
  categories,
  providers,
}: {
  item: {
    id: string;
    sourceUrl: string;
    rawContent: string;
    confidence: number;
    extractedData: ExtractedFields;
    categoryId: string | null;
    suggestedProvider: { id: string; name: string } | null;
    suggestedListing: { id: string; name: string; category: { name: string } } | null;
  };
  categories: CategoryOption[];
  providers: ProviderOption[];
}) {
  const router = useRouter();
  const extracted = item.extractedData;

  const [showRaw, setShowRaw] = useState(false);
  const [name, setName] = useState(extracted.name ?? "");
  const [price, setPrice] = useState(extracted.price != null ? String(extracted.price) : "");
  const [currency, setCurrency] = useState(extracted.currency ?? "USD");
  const [description, setDescription] = useState(extracted.description ?? "");
  const [attributesJson, setAttributesJson] = useState(JSON.stringify(extracted.attributes ?? {}, null, 0));
  const [categoryId, setCategoryId] = useState(item.categoryId ?? categories[0]?.id ?? "");
  const [providerId, setProviderId] = useState(item.suggestedProvider?.id ?? providers[0]?.id ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isUpdate = !!item.suggestedListing;

  async function approve() {
    setError(null);
    let attributes: Record<string, unknown>;
    try {
      attributes = JSON.parse(attributesJson || "{}");
    } catch {
      setError('Attributes must be valid JSON, e.g. {"data_amount": 5}');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/scraped-items/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          edits: {
            name,
            price: Number(price),
            currency,
            description: description || null,
            attributes,
            ...(isUpdate ? {} : { categoryId, providerId }),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? String(data.error) : "Failed to approve");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/scraped-items/${item.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectionReason || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? String(data.error) : "Failed to reject");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.confidence >= 0.7 ? "teal" : item.confidence >= 0.4 ? "sky" : "coral"}>
          {Math.round(item.confidence * 100)}% confidence
        </Badge>
        {isUpdate ? (
          <Badge tone="sky">Update to &quot;{item.suggestedListing!.name}&quot;</Badge>
        ) : (
          <Badge tone="neutral">New listing</Badge>
        )}
        {extracted.provider_name_guess && <Badge tone="neutral">{extracted.provider_name_guess}</Badge>}
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-accent-sky hover:underline"
        >
          <ExternalLink size={12} />
          Source
        </a>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px] sm:col-span-2"
        />
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
          <input
            placeholder="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="tap-target w-20 rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
        </div>
        {!isUpdate && (
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
        )}
        {!isUpdate && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px] sm:col-span-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.sector.name} / {c.name}
              </option>
            ))}
          </select>
        )}
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px] sm:col-span-2"
        />
        <textarea
          placeholder="Attributes JSON"
          value={attributesJson}
          onChange={(e) => setAttributesJson(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-bg-surface p-2 font-mono text-[12px] sm:col-span-2"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="text-[11.5px] font-medium text-text-secondary hover:text-accent-sky"
      >
        {showRaw ? "Hide" : "Show"} the scraped page content this was extracted from
      </button>
      {showRaw && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-bg-surface-raised p-2.5 text-[11px] text-text-secondary">
          {item.rawContent.slice(0, 6000)}
        </pre>
      )}

      {error && <p className="text-[12px] text-accent-coral">{error}</p>}

      {rejecting ? (
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            placeholder="Why this is being rejected (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[12px]"
          />
          <div className="flex gap-1.5">
            <Button variant="danger" size="md" onClick={reject} disabled={loading}>
              Confirm reject
            </Button>
            <Button variant="ghost" size="md" onClick={() => setRejecting(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button onClick={approve} disabled={loading} className="!bg-accent-teal">
            <Check size={14} />
            {loading ? "Approving…" : isUpdate ? "Approve & publish" : "Approve"}
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)} disabled={loading}>
            <X size={14} />
            Reject
          </Button>
        </div>
      )}
    </Card>
  );
}
