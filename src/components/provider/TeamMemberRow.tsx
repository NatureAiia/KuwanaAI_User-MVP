"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, User as UserIcon, X } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function TeamMemberRow({
  email,
  role,
  userId,
}: {
  email: string;
  role: "Owner" | "Teammate";
  /** Present only when the viewer is the owner and this row isn't the owner themself — enables the remove button. */
  userId?: string;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!userId) return;
    if (!confirm(`Remove ${email} from your team?`)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/provider/team/${userId}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card className="flex items-center justify-between gap-3 !p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-surface-raised text-text-secondary">
          {role === "Owner" ? <Crown size={16} className="text-accent-teal" /> : <UserIcon size={16} />}
        </span>
        <div>
          <p className="text-[13.5px] font-medium">{email}</p>
          <p className="text-[11px] text-text-muted">{role}</p>
        </div>
      </div>
      {userId && (
        <button
          type="button"
          onClick={remove}
          disabled={removing}
          aria-label={`Remove ${email}`}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-accent-coral/10 hover:text-accent-coral"
        >
          <X size={16} />
        </button>
      )}
    </Card>
  );
}
