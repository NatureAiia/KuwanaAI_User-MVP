"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function InviteTeammateForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/provider/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong — please try again.");
        return;
      }
      setEmail("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="teammate@example.com"
        className="w-full flex-1 rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-[14px] outline-none focus:border-accent-sky"
      />
      <Button type="submit" disabled={loading} className="sm:w-auto">
        {loading ? "Inviting…" : "Invite"}
      </Button>
      {error && <p className="text-[13px] text-accent-coral sm:basis-full">{error}</p>}
    </form>
  );
}
