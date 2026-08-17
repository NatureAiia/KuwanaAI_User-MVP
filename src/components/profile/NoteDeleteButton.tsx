"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function NoteDeleteButton({ sector, category }: { sector: string; category: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch("/api/user/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, category: category || undefined }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      aria-label="Delete note"
      className="tap-target shrink-0 rounded-full p-1.5 text-text-muted hover:text-accent-coral"
    >
      <Trash2 size={14} />
    </button>
  );
}
