"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px]">
        <span className="font-display text-xl font-bold">kuwana</span>
        <h1 className="mt-6 font-display text-[26px] font-bold">Welcome back</h1>
        <p className="mt-1 text-[14px] text-text-secondary">Log in to pick up where you left off.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-[13px] font-medium text-text-secondary">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-gold"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-text-secondary">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-gold"
            />
          </label>

          {error && <p className="text-[13px] text-accent-coral">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-[13px] text-text-secondary">
          New to Kuwana?{" "}
          <Link href="/signup" className="font-semibold text-accent-gold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
