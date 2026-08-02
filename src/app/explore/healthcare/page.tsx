"use client";

import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BottomTabBar } from "@/components/BottomTabBar";

export default function HealthcareComingSoonPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sector: "healthcare" }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pb-24 pt-16 text-center md:px-10">
      <HeartPulse size={40} className="text-accent-teal" />
      <h1 className="mt-4 font-display text-[26px] font-bold">Healthcare is coming to Kuwana</h1>
      <p className="mt-2 max-w-[42ch] text-[14px] text-text-secondary">
        We&apos;re building explainable comparisons for medical aid, clinics and pharmacies next.
        Join the waitlist to be first to know.
      </p>

      {submitted ? (
        <p className="mt-6 text-[14px] font-medium text-accent-gold">
          You&apos;re on the list — we&apos;ll email you when Healthcare launches.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-[380px] gap-2">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent-gold"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Joining…" : "Join waitlist"}
          </Button>
        </form>
      )}

      <BottomTabBar />
    </div>
  );
}
