"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import WaterButton from "@/components/ui/WaterButton";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { SECTORS, type SectorSlug } from "@/lib/sectors";

export function WaitlistInline({ sector }: { sector: SectorSlug }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const isDesktop = useIsDesktop();
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sector }),
    });
    setStatus("done");
  }

  if (status === "done") {
    return (
      <p className="text-[14px] font-medium text-accent-teal">
        You&apos;re on the list — we&apos;ll email you when {SECTORS[sector].name} launches.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex w-full max-w-[420px] flex-col gap-2 sm:flex-row"
    >
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
      />
      {isDesktop ? (
        <WaterButton
          label={status === "loading" ? "Joining…" : "Join waitlist"}
          disabled={status === "loading"}
          onClick={() => formRef.current?.requestSubmit()}
          paddingX={24}
          paddingY={14}
          rounded={14}
          waterColor="#3E9BD6"
          textColor="#ffffff"
          font={{ fontSize: 14, fontWeight: 600 }}
          glass={{ tint: "rgba(62, 155, 214, 0.18)", blur: 24, frost: 10 }}
          borderOptions={{ color: "rgba(62, 155, 214, 0.5)", stroke: 1 }}
          shadowOptions={{ color: "#141A1F", intensity: 40 }}
        />
      ) : (
        <Button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Joining…" : "Join waitlist"}
        </Button>
      )}
    </form>
  );
}
