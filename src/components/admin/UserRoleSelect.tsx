"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

const ROLES: Role[] = ["consumer", "corporate", "regulator", "provider", "admin"];

export function UserRoleSelect({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const confirm = useConfirmDialog();

  async function changeRole(role: Role) {
    if (role === currentRole) return;
    if (
      !(await confirm.ask({
        title: `Change this user's role to "${role}"? They'll get that role's dashboard on next load.`,
      }))
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {confirm.render()}
      <select
        value={currentRole}
        disabled={loading}
        onChange={(e) => changeRole(e.target.value as Role)}
        className="tap-target rounded-lg border border-border bg-bg-surface p-1.5 text-[12.5px] disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </>
  );
}
