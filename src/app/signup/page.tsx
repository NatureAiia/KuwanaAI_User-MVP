"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { clsx } from "clsx";

const NETWORKS = ["Econet", "NetOne", "Telecel"];
const PLAN_TYPES = ["Prepaid", "Postpaid", "Not sure"];
const SPEND_RANGES = ["Under $10", "$10–$25", "$25–$50", "$50+"];

const LOCAL_FACTS = [
  "Zimbabwe has one of the highest mobile penetration rates in Southern Africa, with over 90% SIM penetration.",
  "Econet Wireless was Zimbabwe's first licensed mobile network operator, launching in 1998.",
  "Mobile money (like EcoCash) is used by the majority of adult Zimbabweans for everyday payments.",
  "Zimbabwe operates a multi-currency system, so comparing prices in USD helps you see real value.",
  "Bundled data plans in Zimbabwe often expire in as little as 24 hours to 30 days — validity matters as much as price.",
  "Building your Kuwana profile takes under a minute and unlocks personalized comparisons immediately.",
];

const STEPS = ["role", "account", "network", "plan", "spend", "consent", "processing"] as const;
type Step = (typeof STEPS)[number];

function ProgressBar({ index }: { index: number }) {
  const pct = ((index + 1) / (STEPS.length - 1)) * 100;
  return (
    <div className="h-1.5 w-full rounded-full bg-bg-surface-raised">
      <div
        className="h-1.5 rounded-full bg-accent-gold transition-all duration-300"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={clsx(
            "tap-target rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
            value === opt
              ? "border-accent-gold bg-accent-gold/15 text-accent-gold"
              : "border-border bg-bg-surface text-text-secondary hover:border-accent-gold/40",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];
  const [error, setError] = useState<string | null>(null);
  const [factIndex, setFactIndex] = useState(0);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [network, setNetwork] = useState("");
  const [planType, setPlanType] = useState("");
  const [spend, setSpend] = useState("");
  const [researchConsent, setResearchConsent] = useState(false);
  const [leaderboardConsent, setLeaderboardConsent] = useState(false);

  const startedProcessing = useRef(false);

  useEffect(() => {
    if (step !== "processing") return;
    const interval = setInterval(() => setFactIndex((i) => (i + 1) % LOCAL_FACTS.length), 2200);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== "processing" || startedProcessing.current) return;
    startedProcessing.current = true;

    (async () => {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setStepIndex(1);
        return;
      }

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          telecomFootprint: {
            primary_network: network,
            plan_type: planType,
            monthly_spend_range: spend,
          },
          consents: {
            research_use: researchConsent,
            leaderboard_participation: leaderboardConsent,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error
            ? "We couldn't save your profile. Check your email to confirm your account, then log in."
            : "Something went wrong saving your profile.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    })();
  }, [step, email, password, fullName, network, planType, spend, researchConsent, leaderboardConsent, router]);

  function next() {
    setError(null);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const canContinue =
    (step === "role" && true) ||
    (step === "account" && fullName.trim() && email.trim() && password.length >= 6) ||
    (step === "network" && network) ||
    (step === "plan" && planType) ||
    (step === "spend" && spend) ||
    (step === "consent" && true);

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-[460px]">
        <span className="font-display text-xl font-bold">kuwana</span>

        {step !== "processing" && (
          <div className="mt-6">
            <ProgressBar index={stepIndex} />
          </div>
        )}

        {step === "role" && (
          <div className="mt-8">
            <h1 className="font-display text-[24px] font-bold">You're signing up as a Consumer</h1>
            <p className="mt-2 text-[14px] text-text-secondary">
              Kuwana also supports Corporate, Regulator and Provider accounts — coming after MVP.
              For now, you'll get the full consumer comparison experience.
            </p>
            <Button onClick={next} size="lg" className="mt-8 w-full">
              Continue
            </Button>
          </div>
        )}

        {step === "account" && (
          <div className="mt-8 space-y-4">
            <h1 className="font-display text-[24px] font-bold">Create your account</h1>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Full name</span>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">
                Password (min 6 characters)
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-gold"
              />
            </label>
            <p className="text-[12px] text-text-muted">
              We only use this to secure your account — never shared with providers.
            </p>
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={next} disabled={!canContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "network" && (
          <div className="mt-8 space-y-4">
            <h1 className="font-display text-[24px] font-bold">Who's your primary network?</h1>
            <p className="text-[13px] text-text-secondary">
              This personalizes your telecom comparisons from day one.
            </p>
            <ChipGroup options={NETWORKS} value={network} onChange={setNetwork} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={next} disabled={!canContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "plan" && (
          <div className="mt-8 space-y-4">
            <h1 className="font-display text-[24px] font-bold">What plan type do you use?</h1>
            <ChipGroup options={PLAN_TYPES} value={planType} onChange={setPlanType} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={next} disabled={!canContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "spend" && (
          <div className="mt-8 space-y-4">
            <h1 className="font-display text-[24px] font-bold">
              Roughly how much do you spend monthly on airtime/data?
            </h1>
            <ChipGroup options={SPEND_RANGES} value={spend} onChange={setSpend} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={next} disabled={!canContinue} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "consent" && (
          <div className="mt-8 space-y-4">
            <h1 className="font-display text-[24px] font-bold">Before we save your profile</h1>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
              <input
                type="checkbox"
                checked={researchConsent}
                onChange={(e) => setResearchConsent(e.target.checked)}
                className="mt-0.5 tap-target"
              />
              <span className="text-[13px] text-text-secondary">
                Allow anonymized use of my comparison activity to improve Kuwana's recommendations.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
              <input
                type="checkbox"
                checked={leaderboardConsent}
                onChange={(e) => setLeaderboardConsent(e.target.checked)}
                className="mt-0.5 tap-target"
              />
              <span className="text-[13px] text-text-secondary">
                Join the opt-in XP leaderboard under a nickname (never your real name).
              </span>
            </label>
            <p className="text-[12px] text-text-muted">
              You can change either setting anytime in Settings.
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={next} className="flex-1">
                Save my profile
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-gold border-t-transparent" />
            <h1 className="mt-6 font-display text-[20px] font-bold">Saving your profile…</h1>
            <p className="mt-3 max-w-[36ch] text-[13px] text-text-secondary">
              {LOCAL_FACTS[factIndex]}
            </p>
            {error && (
              <div className="mt-6 space-y-3">
                <p className="text-[13px] text-accent-coral">{error}</p>
                <Button variant="secondary" onClick={() => router.push("/login")}>
                  Go to login
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
