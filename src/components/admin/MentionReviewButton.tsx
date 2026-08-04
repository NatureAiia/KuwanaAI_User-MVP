"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function MentionReviewButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markReviewed() {
    setLoading(true);
    await fetch("/api/admin/social-mentions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reviewed: true }),
    }).catch(() => {});
    router.refresh();
  }

  return (
    <Button variant="secondary" size="md" onClick={markReviewed} disabled={loading}>
      <Check size={14} />
      {loading ? "Marking…" : "Mark reviewed"}
    </Button>
  );
}
