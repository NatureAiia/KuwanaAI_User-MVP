"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { buildFactQueue } from "@/lib/onboarding-facts";
import { DynamicBar } from "@/components/ui/DynamicBar";
import { Check, User, type LucideIcon } from "lucide-react";
import {
  AGE_RANGES,
  OCCUPATIONS,
  SOCIAL_PLATFORMS,
  NETWORKS,
  PLAN_TYPES,
  SPEND_RANGES,
  BANKS,
  ACCOUNT_TYPES,
  INSURERS,
  POLICY_TYPES,
  MEDICAL_AIDS,
} from "@/lib/onboarding-options";
import { clsx } from "clsx";

type Role = "consumer" | "regulator" | "corporate";

const ROLE_OPTIONS: {
  id: Role;
  icon: LucideIcon;
  title: string;
  desc: string;
  bullet: string;
  meta: string;
}[] = [
  {
    id: "consumer",
    icon: User,
    title: "Consumer",
    desc: "Track your personal data footprint across telecoms, banking, insurance & health providers.",
    bullet: "For data subjects",
    meta: "5-step profile",
  },
  // Regulator and Corporate are deliberately NOT self-service options here —
  // /api/onboarding only ever accepts role: "consumer" from this endpoint.
  // Those accounts are admin-provisioned (see build plan: regulator
  // self-registration is explicitly disallowed), never granted by a user
  // simply picking a card, since they unlock market-intelligence/compliance
  // views a consumer shouldn't be able to opt into.
];

const CONSUMER_STEPS = [
  "account",
  "personal",
  "telecom",
  "banking",
  "insurance",
  "health",
  "consent",
] as const;
type ConsumerStep = (typeof CONSUMER_STEPS)[number];
type Step = "role" | ConsumerStep | "processing";

function ProgressBar({ step }: { step: ConsumerStep }) {
  const index = CONSUMER_STEPS.indexOf(step);
  const pct = ((index + 1) / CONSUMER_STEPS.length) * 100;
  return <DynamicBar value={pct} color="sky" />;
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
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border bg-bg-surface text-text-secondary hover:border-accent-sky/40",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultiChipGroup({
  options,
  values,
  onToggle,
}: {
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          className={clsx(
            "tap-target rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
            values.includes(opt)
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border bg-bg-surface text-text-secondary hover:border-accent-sky/40",
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
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<Step>("role");
  const historyRef = useRef<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [factIndex, setFactIndex] = useState(0);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [ageRange, setAgeRange] = useState("");
  const [occupation, setOccupation] = useState("");
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>([]);

  const [network, setNetwork] = useState("");
  const [planType, setPlanType] = useState("");
  const [spend, setSpend] = useState("");

  const [bank, setBank] = useState("");
  const [accountTypes, setAccountTypes] = useState<string[]>([]);

  const [insurer, setInsurer] = useState("");
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);

  const [medicalAid, setMedicalAid] = useState("");
  const [chronicOptIn, setChronicOptIn] = useState(false);
  const [healthDataConsent, setHealthDataConsent] = useState(false);

  const [researchConsent, setResearchConsent] = useState(false);
  const [leaderboardConsent, setLeaderboardConsent] = useState(false);

  const startedProcessing = useRef(false);
  const [factQueue, setFactQueue] = useState<string[]>([]);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function go(next: Step) {
    setError(null);
    historyRef.current.push(step);
    setStep(next);
  }
  function back() {
    setError(null);
    const prev = historyRef.current.pop();
    setStep(prev ?? "role");
  }

  useEffect(() => {
    if (step !== "processing" || factQueue.length === 0) return;
    const interval = setInterval(
      () => setFactIndex((i) => (i + 1) % factQueue.length),
      2200,
    );
    return () => clearInterval(interval);
  }, [step, factQueue]);

  useEffect(() => {
    if (step !== "processing" || startedProcessing.current) return;
    startedProcessing.current = true;

    (async () => {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setStep("account");
        return;
      }

      const bankSelected = bank && bank !== "I don't bank";
      const insuranceSelected = insurer && insurer !== "I don't have insurance";

      const isConsumer = role === "consumer";
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: role ?? "consumer",
          fullName,
          ageRange,
          occupation,
          socialPlatforms,
          telecomFootprint: isConsumer
            ? { primary_network: network, plan_type: planType, monthly_spend_range: spend }
            : undefined,
          bankingFootprint: isConsumer && bankSelected ? { bank_name: bank, account_types: accountTypes } : undefined,
          insuranceFootprint: isConsumer
            ? {
                provider: insurer,
                policy_types: insuranceSelected ? policyTypes : [],
                has_insurance: !!insuranceSelected,
              }
            : undefined,
          healthcareFootprint: isConsumer
            ? { medical_aid_provider: medicalAid, chronic_condition_disclosure_opt_in: chronicOptIn }
            : undefined,
          consents: {
            research_use: researchConsent,
            leaderboard_participation: leaderboardConsent,
            health_data_sharing: healthDataConsent,
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
  }, [
    step,
    role,
    email,
    password,
    fullName,
    ageRange,
    occupation,
    socialPlatforms,
    network,
    planType,
    spend,
    bank,
    accountTypes,
    insurer,
    policyTypes,
    medicalAid,
    chronicOptIn,
    healthDataConsent,
    researchConsent,
    leaderboardConsent,
    router,
  ]);

  function canContinue(s: ConsumerStep) {
    switch (s) {
      case "account":
        return !!(fullName.trim() && email.trim() && password.length >= 6);
      case "personal":
        return !!(ageRange && occupation);
      case "telecom":
        return !!(network && planType && spend);
      case "banking":
        return !!bank;
      case "insurance":
        return !!insurer;
      case "health":
        return !!medicalAid;
      case "consent":
        return true;
    }
  }

  function startProcessing() {
    setFactQueue(
      buildFactQueue([
        network,
        bank !== "I don't bank" ? bank : undefined,
        insurer !== "I don't have insurance" ? insurer : undefined,
        medicalAid !== "None" ? medicalAid : undefined,
      ]),
    );
    setFactIndex(0);
    go("processing");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-10">
      <div className={clsx("w-full", step === "role" ? "max-w-[820px]" : "max-w-[460px]")}>
        <div className="flex items-center gap-2">
          <Image src="/kuwana-mark.png" alt="" width={28} height={28} />
          <span className="font-display text-xl font-bold">kuwana.ai</span>
        </div>

        {(CONSUMER_STEPS as readonly string[]).includes(step) && (
          <div className="mt-6">
            <ProgressBar step={step as ConsumerStep} />
          </div>
        )}

        {step === "role" && (
          <div className="mt-8">
            <h1 className="font-display text-[24px] font-bold">How will you use Kuwana?</h1>
            <p className="mt-2 text-[14px] text-text-secondary">
              This helps us personalize your experience and dashboard.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRole(option.id)}
                    className={clsx(
                      "tap-target relative rounded-[var(--radius-card)] border p-5 text-left transition-all",
                      selected
                        ? "border-accent-teal bg-accent-teal/[0.08] ring-1 ring-accent-teal/30"
                        : "border-border bg-bg-surface hover:border-accent-teal/40 hover:shadow-sm",
                    )}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent-teal text-[#0b1512]">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                    <div
                      className={clsx(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        selected ? "bg-accent-teal/15 text-accent-teal" : "bg-bg-surface-raised text-text-secondary",
                      )}
                    >
                      <option.icon size={20} strokeWidth={1.75} />
                    </div>
                    <div className="mt-4 text-[15px] font-semibold">{option.title}</div>
                    <p className="mt-1.5 text-[12px] leading-[1.6] text-text-secondary">
                      {option.desc}
                    </p>
                    <Badge tone={selected ? "teal" : "neutral"} className="mt-4">
                      {option.bullet}
                    </Badge>
                    <p className="mt-3 text-[11px] font-medium text-text-muted">{option.meta}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
              <span className="text-[12px] text-text-secondary">
                {role
                  ? `Selected: ${ROLE_OPTIONS.find((r) => r.id === role)?.title}`
                  : "Select a role to continue"}
              </span>
              <Button onClick={() => go("account")} disabled={!role}>
                Continue →
              </Button>
            </div>
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
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
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
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
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
              <Button
                onClick={() => go(role === "consumer" ? "personal" : "consent")}
                disabled={!canContinue("account")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "personal" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Tell us about yourself</h1>
            <p className="text-[13px] text-text-secondary">
              This context helps map your data footprint — never shown publicly.
            </p>
            <div>
              <span className="text-[13px] font-medium text-text-secondary">Age range</span>
              <div className="mt-2">
                <ChipGroup options={AGE_RANGES} value={ageRange} onChange={setAgeRange} />
              </div>
            </div>
            <div>
              <span className="text-[13px] font-medium text-text-secondary">Occupation</span>
              <div className="mt-2">
                <ChipGroup options={OCCUPATIONS} value={occupation} onChange={setOccupation} />
              </div>
            </div>
            <div>
              <span className="text-[13px] font-medium text-text-secondary">
                Social platforms you use (optional)
              </span>
              <div className="mt-2">
                <MultiChipGroup
                  options={SOCIAL_PLATFORMS}
                  values={socialPlatforms}
                  onToggle={(v) => toggle(socialPlatforms, setSocialPlatforms, v)}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("telecom")}
                disabled={!canContinue("personal")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "telecom" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Who&apos;s your primary network?</h1>
            <p className="text-[13px] text-text-secondary">
              This personalizes your telecom comparisons from day one.
            </p>
            <ChipGroup options={NETWORKS} value={network} onChange={setNetwork} />
            <div>
              <span className="text-[13px] font-medium text-text-secondary">Plan type</span>
              <div className="mt-2">
                <ChipGroup options={PLAN_TYPES} value={planType} onChange={setPlanType} />
              </div>
            </div>
            <div>
              <span className="text-[13px] font-medium text-text-secondary">
                Monthly spend on airtime/data
              </span>
              <div className="mt-2">
                <ChipGroup options={SPEND_RANGES} value={spend} onChange={setSpend} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("banking")}
                disabled={!canContinue("telecom")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "banking" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Banking relationships</h1>
            <ChipGroup options={BANKS} value={bank} onChange={setBank} />
            {bank && bank !== "I don't bank" && (
              <div>
                <span className="text-[13px] font-medium text-text-secondary">Account types</span>
                <div className="mt-2">
                  <MultiChipGroup
                    options={ACCOUNT_TYPES}
                    values={accountTypes}
                    onToggle={(v) => toggle(accountTypes, setAccountTypes, v)}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("insurance")}
                disabled={!canContinue("banking")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "insurance" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Insurance coverage</h1>
            <ChipGroup options={INSURERS} value={insurer} onChange={setInsurer} />
            {insurer && insurer !== "I don't have insurance" && (
              <div>
                <span className="text-[13px] font-medium text-text-secondary">Policy types</span>
                <div className="mt-2">
                  <MultiChipGroup
                    options={POLICY_TYPES}
                    values={policyTypes}
                    onToggle={(v) => toggle(policyTypes, setPolicyTypes, v)}
                  />
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("health")}
                disabled={!canContinue("insurance")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "health" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Health data</h1>
            <ChipGroup options={MEDICAL_AIDS} value={medicalAid} onChange={setMedicalAid} />
            <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
              <input
                type="checkbox"
                checked={chronicOptIn}
                onChange={(e) => setChronicOptIn(e.target.checked)}
                className="mt-0.5 tap-target"
              />
              <span className="text-[13px] text-text-secondary">
                Opt in to disclose chronic conditions — helps calculate a more accurate sensitivity
                score. Stored securely and never shown publicly.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
              <input
                type="checkbox"
                checked={healthDataConsent}
                onChange={(e) => setHealthDataConsent(e.target.checked)}
                className="mt-0.5 tap-target"
              />
              <span className="text-[13px] text-text-secondary">
                Separately, allow anonymized use of my health data to improve Kuwana&apos;s
                healthcare comparisons — distinct from the general research consent on the next
                screen, since health data deserves its own opt-in.
              </span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("consent")}
                disabled={!canContinue("health")}
                className="flex-1"
              >
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
                Allow anonymized use of my comparison activity to improve Kuwana&apos;s
                recommendations.
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
              <Button onClick={startProcessing} className="flex-1">
                Save my profile
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-sky border-t-transparent" />
            <h1 className="mt-6 font-display text-[20px] font-bold">Saving your profile…</h1>
            <p className="mt-3 max-w-[36ch] text-[13px] text-text-secondary">
              {factQueue[factIndex]}
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
