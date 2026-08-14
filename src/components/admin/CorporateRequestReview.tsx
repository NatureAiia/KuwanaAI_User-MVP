"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Badge, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SlaBadge } from "@/components/corporate/SlaBadge";

type ProposedData = {
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  attributes?: Record<string, unknown>;
};

export function CorporateRequestReview({
  request,
}: {
  request: {
    id: string;
    type: "edit" | "new_listing";
    reason: string;
    provider: { name: string };
    proposedData: ProposedData;
    listing: { id: string; name: string; price: unknown; currency: string } | null;
    category: { name: string; sector: { name: string } } | null;
    dueAt?: Date | string | null;
  };
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function approve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/corporate-requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", note: approvalNote || undefined }),
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
      const res = await fetch(`/api/admin/corporate-requests/${request.id}`, {
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

  const proposed = request.proposedData;

  return (
    <Card className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="sky">{request.provider.name}</Badge>
        {request.type === "edit" && request.listing ? (
          <Badge tone="neutral">Edit &quot;{request.listing.name}&quot;</Badge>
        ) : (
          <Badge tone="neutral">
            New product{request.category ? ` — ${request.category.sector.name} / ${request.category.name}` : ""}
          </Badge>
        )}
        <SlaBadge dueAt={request.dueAt ?? null} status="pending" />
      </div>

      <div className="grid gap-2 text-[13px] sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-text-muted">Name</p>
          <p className="font-medium">{proposed.name}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted">Price</p>
          <p className="font-mono">
            {proposed.currency} {Number(proposed.price).toFixed(2)}
            {request.type === "edit" && request.listing && (
              <span className="ml-1.5 text-[11px] text-text-muted">
                (was {request.listing.currency} {Number(request.listing.price).toFixed(2)})
              </span>
            )}
          </p>
        </div>
        {proposed.description && (
          <div className="sm:col-span-2">
            <p className="text-[11px] text-text-muted">Description</p>
            <p className="text-text-secondary">{proposed.description}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] text-text-muted">Business&apos;s reason</p>
        <p className="text-[13px] text-text-secondary">{request.reason}</p>
      </div>

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
      ) : signingOff ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[12px] text-text-secondary">
            Confirming applies this change to the live catalog immediately. Optionally leave an internal note.
          </p>
          <input
            autoFocus
            placeholder="Sign-off note (optional, internal only)"
            value={approvalNote}
            onChange={(e) => setApprovalNote(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[12px]"
          />
          <div className="flex gap-1.5">
            <Button onClick={approve} disabled={loading} className="!bg-accent-teal">
              <Check size={14} />
              {loading ? "Approving…" : "Confirm approval"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setSigningOff(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button onClick={() => setSigningOff(true)} disabled={loading} className="!bg-accent-teal">
            <Check size={14} />
            Approve
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
