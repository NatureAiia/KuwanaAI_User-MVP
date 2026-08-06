"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { ProviderListingThumbnail } from "@/components/provider/ProviderListingThumbnail";
import { ProviderListingRowActions } from "@/components/provider/ProviderListingRowActions";

type Status = "draft" | "pending_review" | "published" | "rejected";

export type ProviderListingRow = {
  id: string;
  name: string;
  images: string[];
  price: number;
  currency: string;
  status: Status;
  category: { name: string; sector: { name: string } };
  savedCount: number;
  comparisonAppearances: number;
};

const STATUS_TONE: Record<Status, "neutral" | "sky" | "teal" | "coral"> = {
  draft: "neutral",
  pending_review: "sky",
  published: "teal",
  rejected: "coral",
};

export function ProviderListingsTable({ rows }: { rows: ProviderListingRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const submittable = selectedRows.filter((r) => r.status === "draft" || r.status === "rejected");
  const deletable = selectedRows.filter((r) => r.status !== "published");

  async function bulkSubmit() {
    setBulkLoading(true);
    try {
      await Promise.all(
        submittable.map((r) =>
          fetch(`/api/provider/listings/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "pending_review" }),
          }),
        ),
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${deletable.length} product(s)? This can't be undone.`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(deletable.map((r) => fetch(`/api/provider/listings/${r.id}`, { method: "DELETE" })));
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border p-10 text-center">
        <p className="text-[13.5px] text-text-muted">No products match these filters yet.</p>
        <LinkButton href="/provider/listings/new" size="md">
          + Add product
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent-sky/40 bg-accent-sky/10 px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-accent-sky">{selected.size} selected</span>
          {submittable.length > 0 && (
            <Button size="md" onClick={bulkSubmit} disabled={bulkLoading} className="!px-3 !py-1.5 !text-[12px]">
              Submit {submittable.length} for review
            </Button>
          )}
          {deletable.length > 0 && (
            <Button
              variant="danger"
              size="md"
              onClick={bulkDelete}
              disabled={bulkLoading}
              className="!px-3 !py-1.5 !text-[12px]"
            >
              Delete {deletable.length}
            </Button>
          )}
        </div>
      )}

      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-border md:block">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised text-left">
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  checked={selected.size === rows.length}
                  onChange={toggleAll}
                  className="tap-target"
                  aria-label="Select all"
                />
              </th>
              <th className="p-3 font-medium text-text-muted">Product</th>
              <th className="p-3 font-medium text-text-muted">Category</th>
              <th className="p-3 font-medium text-text-muted">Price</th>
              <th className="p-3 font-medium text-text-muted">Status</th>
              <th className="p-3 font-medium text-text-muted">Activity</th>
              <th className="p-3 font-medium text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="tap-target"
                    aria-label={`Select ${r.name}`}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <ProviderListingThumbnail images={r.images} name={r.name} size={36} />
                    <Link href={`/provider/listings/${r.id}/edit`} className="font-medium hover:text-accent-sky">
                      {r.name}
                    </Link>
                  </div>
                </td>
                <td className="p-3 text-text-secondary">
                  {r.category.sector.name} <span className="text-text-muted">/ {r.category.name}</span>
                </td>
                <td className="p-3 font-mono">
                  {r.currency} {r.price.toFixed(2)}
                </td>
                <td className="p-3">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
                </td>
                <td className="p-3 text-[12px] text-text-muted">
                  {r.savedCount} saved · {r.comparisonAppearances} compared
                </td>
                <td className="p-3">
                  <ProviderListingRowActions listingId={r.id} status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-3.5">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="tap-target mt-1"
                aria-label={`Select ${r.name}`}
              />
              <ProviderListingThumbnail images={r.images} name={r.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/provider/listings/${r.id}/edit`} className="truncate font-medium">
                    {r.name}
                  </Link>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] text-text-muted">
                  {r.category.sector.name} / {r.category.name}
                </p>
                <p className="mt-0.5 font-mono text-[13px]">
                  {r.currency} {r.price.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="mt-2.5">
              <ProviderListingRowActions listingId={r.id} status={r.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
