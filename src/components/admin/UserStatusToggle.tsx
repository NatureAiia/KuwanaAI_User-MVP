"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountStatus } from "@prisma/client";

export function UserStatusToggle({ userId, status }: { userId: string; status: AccountStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const suspended = status === "suspended";

  async function toggle() {
    let suspendedReason: string | undefined;

    if (suspended) {
      if (!confirm("Reactivate this account? They'll regain full access immediately.")) return;
    } else {
      const input = window.prompt("Reason for deactivating this account (optional — shown in the audit log):");
      if (input === null) return; // cancelled, not just left blank
      suspendedReason = input.trim() || undefined;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountStatus: suspended ? "active" : "suspended", suspendedReason }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`tap-target rounded-lg border px-2.5 py-1.5 text-[12px] font-medium disabled:opacity-50 ${
        suspended
          ? "border-accent-coral/50 text-accent-coral hover:bg-accent-coral/10"
          : "border-border text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral"
      }`}
    >
      {suspended ? "Suspended — reactivate" : "Deactivate"}
    </button>
  );
}
