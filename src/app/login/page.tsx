"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import WaterButton from "@/components/ui/WaterButton";
import { AuthTopBar } from "@/components/AuthTopBar";
import { useIsDesktop } from "@/lib/useIsDesktop";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isDesktop = useIsDesktop();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
    <div className="w-full max-w-[420px]">
      <div className="flex items-center gap-2">
        <Image src="/kuwana-mark.png" alt="" width={28} height={28} />
        <span className="font-display text-xl font-bold">kuwana.ai</span>
      </div>
      <h1 className="mt-6 font-display text-[26px] font-bold">Welcome back</h1>
      <p className="mt-1 text-[14px] text-text-secondary">Log in to pick up where you left off.</p>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-text-secondary">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-text-secondary">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
          />
        </label>

        {error && <p className="text-[13px] text-accent-coral">{error}</p>}

        {isDesktop ? (
          <WaterButton
            label={loading ? "Logging in…" : "Log in"}
            disabled={loading}
            onClick={() => formRef.current?.requestSubmit()}
            paddingX={0}
            paddingY={16}
            rounded={14}
            style={{ width: "100%" }}
            waterColor="#3E9BD6"
            textColor="#ffffff"
            font={{ fontSize: 15, fontWeight: 600 }}
            glass={{ tint: "rgba(62, 155, 214, 0.18)", blur: 24, frost: 10 }}
            borderOptions={{ color: "rgba(62, 155, 214, 0.5)", stroke: 1 }}
            shadowOptions={{ color: "#141A1F", intensity: 40 }}
          />
        ) : (
          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Logging in…" : "Log in"}
          </Button>
        )}
      </form>

      <p className="mt-6 text-center text-[13px] text-text-secondary">
        New to Kuwana?{" "}
        <Link href="/signup" className="font-semibold text-accent-sky">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-5 py-10">
      <AuthTopBar />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
