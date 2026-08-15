"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";

export function ApiKeyRowActions({ id, revoked }: { id: string; revoked: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function revoke() {
    if (!confirm("Revoke this key? Any BI tool using it will immediately lose access.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: "PATCH" });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (revoked) return <span className="text-[12px] text-text-muted">Revoked</span>;

  return (
    <button
      type="button"
      onClick={revoke}
      disabled={loading}
      className="tap-target flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-secondary hover:border-accent-coral/50 hover:text-accent-coral disabled:opacity-50"
    >
      <Ban size={13} />
      Revoke
    </button>
  );
}
