"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function WaitlistInline() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sector: "healthcare" }),
    });
    setStatus("done");
  }

  if (status === "done") {
    return (
      <p className="text-[14px] font-medium text-accent-teal">
        You&apos;re on the list — we&apos;ll email you when Healthcare launches.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-[420px] flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
      />
      <Button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Joining…" : "Join waitlist"}
      </Button>
    </form>
  );
}
