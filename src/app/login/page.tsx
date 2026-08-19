"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { safeRedirectPath } from "@/lib/safeRedirect";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import WaterButton from "@/components/ui/WaterButton";
import { AuthTopBar } from "@/components/AuthTopBar";
import { Turnstile } from "@/components/Turnstile";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { markHardNav } from "@/components/SoftNavTracker";
import { LoadingFacts } from "@/components/loading/LoadingFacts";

// The destination route's own loading.tsx only stays up until that page's
// data is ready, which can be near-instant — too short for the tunnel to
// read as an intentional moment rather than a flicker. Holding it here for a
// fixed minimum, measured from the moment credentials are confirmed valid,
// guarantees the same tunnel experience every time regardless of backend
// speed.
const MIN_TUNNEL_MS = 45000;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const isDesktop = useIsDesktop();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  // Empty when Turnstile isn't configured; verifyTurnstileToken no-ops then.
  const [captchaToken, setCaptchaToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const redirectDestRef = useRef<string | null>(null);
  const redirectTimeoutRef = useRef<number | null>(null);

  function finishRedirect() {
    if (redirectTimeoutRef.current !== null) {
      window.clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    markHardNav();
    router.push(redirectDestRef.current ?? "/dashboard");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", { email, password, turnstileToken: captchaToken, redirect: false });
    if (result?.error) {
      setLoading(false);
      // authorize() masks every failure reason as CredentialsSignin — wrong
      // password, unknown email, and a rate limit all land here identically
      // by design (see src/lib/nextAuth.ts), except the rate-limit and
      // captcha codes, which get their own messages since "wrong password"
      // would be misleading in either case.
      setError(
        result.code === "too_many_attempts"
          ? "Too many attempts — please wait a few minutes and try again."
          : result.code === "captcha_failed"
            ? "Couldn't verify you're human — please try again."
            : "That email and password don't match. Check for typos, or reset your password.",
      );
      return;
    }

    // requireUser() (lib/auth.ts) treats a suspended account as "not signed
    // in" everywhere else in the app — without this check, a deactivated
    // user would sign in here successfully then get silently bounced back to
    // /login with no explanation the moment the next page's requireUser()
    // call returns null.
    const statusRes = await fetch("/api/auth/account-status");
    const status = await statusRes.json().catch(() => null);
    if (status?.suspended) {
      await signOut({ redirect: false });
      setLoading(false);
      setError("This account has been deactivated. Contact support if you think this is a mistake.");
      return;
    }

    // `next` is attacker-controllable — anyone can send a link with their own
    // value. Passing it to the router unchecked is an open redirect off the
    // back of a successful login. See lib/safeRedirect.ts.
    const dest = safeRedirectPath(params.get("next"));
    const start = Date.now();
    redirectDestRef.current = dest;
    setRedirecting(true);
    redirectTimeoutRef.current = window.setTimeout(
      finishRedirect,
      Math.max(0, MIN_TUNNEL_MS - (Date.now() - start)),
    );
  }

  if (redirecting) {
    return (
      <LoadingFacts title="Welcome back" subtitle="Loading your dashboard" onSkip={finishRedirect} />
    );
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
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-text-secondary">Password</span>
          <PasswordInput
            required
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5"
          />
        </label>

        {error && <p className="text-[13px] text-accent-coral">{error}</p>}

        <Turnstile onToken={setCaptchaToken} />

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
