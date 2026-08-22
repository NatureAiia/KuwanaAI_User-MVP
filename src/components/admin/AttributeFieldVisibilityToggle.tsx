"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Flips one AttributeSchemaField's isComparable on/off — see /api/admin/attribute-schema/[id]. */
export function AttributeFieldVisibilityToggle({ id, isComparable }: { id: string; isComparable: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attribute-schema/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isComparable: !isComparable }),
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
      className={`tap-target rounded-full border px-3 py-1 text-[11.5px] font-medium disabled:opacity-50 ${
        isComparable
          ? "border-accent-teal/50 bg-accent-teal/10 text-accent-teal"
          : "border-border text-text-secondary"
      }`}
    >
      {isComparable ? "Comparable" : "Hidden"}
    </button>
  );
}
