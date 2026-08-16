"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export function ProviderListingRowActions({
  listingId,
  status,
}: {
  listingId: string;
  status: "draft" | "pending_review" | "rejected" | "published";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirmDialog();

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(`/api/provider/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!(await confirm.ask({ title: "Delete this product?", description: "This can't be undone.", danger: true })))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/provider/listings/${listingId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <div className="flex flex-wrap items-center gap-1.5">
      <Link
        href={`/provider/listings/${listingId}/edit`}
        className="tap-target rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
      >
        Edit
      </Link>
      {(status === "draft" || status === "rejected") && (
        <Button
          size="md"
          onClick={() => patch({ status: "pending_review" })}
          disabled={loading}
          className="!px-2.5 !py-1.5 !text-[12px]"
        >
          {status === "rejected" ? "Resubmit" : "Submit"}
        </Button>
      )}
      {status !== "published" && (
        <Button variant="danger" size="md" onClick={remove} disabled={loading} className="!px-2.5 !py-1.5 !text-[12px]">
          Delete
        </Button>
      )}
      </div>
    </>
  );
}
