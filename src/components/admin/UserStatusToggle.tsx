"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountStatus } from "@prisma/client";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

type ListingAction = "keep" | "remove";

export function UserStatusToggle({
  userId,
  status,
  providerListingCount = 0,
}: {
  userId: string;
  status: AccountStatus;
  providerListingCount?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const suspended = status === "suspended";
  const confirm = useConfirmDialog();

  async function submit(listingAction: ListingAction) {
    if (
      listingAction === "remove" &&
      !(await confirm.ask({
        title: `This permanently deletes all ${providerListingCount} listing(s) for this provider and revokes any API keys. Continue?`,
        description: "This can't be undone.",
        danger: true,
      }))
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountStatus: "suspended",
          suspendedReason: reason.trim() || undefined,
          listingAction,
        }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function reactivate() {
    if (!(await confirm.ask({ title: "Reactivate this account? They'll regain full access immediately." })))
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountStatus: "active" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <button
        onClick={() => (suspended ? reactivate() : setOpen(true))}
        disabled={loading}
        className={`tap-target rounded-lg border px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-50 ${
          suspended
            ? "border-accent-coral/50 text-accent-coral hover:bg-accent-coral/10"
            : "border-border text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
        }`}
      >
        {suspended ? "Suspended — reactivate" : "Deactivate"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Deactivate account"
          onClick={() => !loading && setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-border bg-bg-surface p-5"
          >
            <p className="font-display text-[15px] font-semibold">Deactivate account</p>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              {providerListingCount > 0
                ? `This account owns ${providerListingCount} listing(s). Choose what happens to them.`
                : "This account doesn't own any listings — the deactivation just blocks their access."}
            </p>

            <label className="mt-3 block">
              <span className="text-[12px] font-medium text-text-secondary">Reason (optional — shown in the audit log)</span>
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="tap-target mt-1 w-full rounded-lg border border-border bg-bg-base p-2.5 text-[13px]"
              />
            </label>

            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => submit("keep")}
                disabled={loading}
                className="tap-target rounded-lg border border-border px-3 py-2.5 text-left text-[13px] font-medium text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky disabled:opacity-50"
              >
                Temporary — deactivate only
                <span className="block text-[11.5px] font-normal text-text-muted">
                  {providerListingCount > 0 ? "Listings stay live. Reversible any time." : "Reversible any time."}
                </span>
              </button>

              {providerListingCount > 0 && (
                <button
                  onClick={() => submit("remove")}
                  disabled={loading}
                  className="tap-target rounded-lg border border-accent-coral/50 px-3 py-2.5 text-left text-[13px] font-medium text-accent-coral hover:bg-accent-coral/10 disabled:opacity-50"
                >
                  Permanent — deactivate and delete listings
                  <span className="block text-[11.5px] font-normal text-accent-coral/80">
                    Deletes all {providerListingCount} listing(s) and revokes any API keys. Can&apos;t be undone.
                  </span>
                </button>
              )}
            </div>

            <button
              onClick={() => setOpen(false)}
              disabled={loading}
              className="tap-target mt-3 w-full rounded-lg py-2 text-[12.5px] font-medium text-text-muted hover:text-text-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
