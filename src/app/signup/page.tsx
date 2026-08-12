"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import WaterButton from "@/components/ui/WaterButton";
import { Badge } from "@/components/ui/Card";
import { AuthTopBar } from "@/components/AuthTopBar";
import { ProviderLogo } from "@/components/ProviderLogo";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { LoadingFacts } from "@/components/loading/LoadingFacts";
import { DynamicBar } from "@/components/ui/DynamicBar";
import { markHardNav } from "@/components/SoftNavTracker";
import { Check, User, Building2, Store, Landmark, type LucideIcon } from "lucide-react";
import {
  AGE_RANGES,
  OCCUPATIONS,
  SOCIAL_PLATFORMS,
  NETWORKS,
  PLAN_TYPES,
  SPEND_RANGES,
  BANKS,
  ACCOUNT_TYPES,
  WALLETS,
  INSURERS,
  POLICY_TYPES,
  MEDICAL_AIDS,
} from "@/lib/onboarding-options";
import { REGULATORS } from "@/lib/orgVerification";
import { clsx } from "clsx";

type Role = "consumer" | "corporate" | "provider" | "regulator";

// Corporate/Provider/Regulator each grant elevated access (Market
// Intelligence, a Provider listing portal, Compliance & Market Monitoring),
// so each is backed by a real server-side check in /api/onboarding rather
// than the client simply asserting a role — see src/lib/orgVerification.ts
// and HANDOFF.md's "Security — do not reopen these" for why that check
// exists at all. Admin is deliberately not here: it isn't a Role, it's the
// ADMIN_EMAILS allowlist, and never becomes a signup option.
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
  {
    id: "corporate",
    icon: Building2,
    title: "Corporate",
    desc: "Bank, telco, insurer, or hospital — monitor market intelligence across every sector.",
    bullet: "Work email required",
    meta: "1-step setup",
  },
  {
    id: "provider",
    icon: Store,
    title: "Provider self-service",
    desc: "List and manage your own products or services — a kiosk, an agent, a small business.",
    bullet: "For any business, any size",
    meta: "1-step setup",
  },
  {
    id: "regulator",
    icon: Landmark,
    title: "Regulator",
    desc: "POTRAZ, RBZ, IPEC — monitor compliance and complaints across the market.",
    bullet: "Verified institutional email required",
    meta: "1-step setup",
  },
];

const CONSUMER_STEPS = [
  "account",
  "personal",
  "telecom",
  "banking",
  "wallets",
  "insurance",
  "health",
  "consent",
] as const;
type ConsumerStep = (typeof CONSUMER_STEPS)[number];
type Step = "role" | ConsumerStep | "orgDetails" | "processing";

function ProgressBar({ step }: { step: ConsumerStep }) {
  const index = CONSUMER_STEPS.indexOf(step);
  const pct = ((index + 1) / CONSUMER_STEPS.length) * 100;
  return (
    <DynamicBar
      value={pct}
      color="sky"
      ariaLabel={`Signup progress: step ${index + 1} of ${CONSUMER_STEPS.length}`}
    />
  );
}

function ChipGroup({
  options,
  value,
  onChange,
  renderOption,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  renderOption?: (opt: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={clsx(
            "tap-target flex items-center gap-2 rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
            value === opt
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border bg-bg-surface text-text-secondary hover:border-accent-sky/40",
          )}
        >
          {renderOption ? renderOption(opt) : null}
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
  renderOption,
}: {
  options: string[];
  values: string[];
  onToggle: (v: string) => void;
  renderOption?: (opt: string) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onToggle(opt)}
          aria-pressed={values.includes(opt)}
          className={clsx(
            "tap-target flex items-center gap-2 rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
            values.includes(opt)
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border bg-bg-surface text-text-secondary hover:border-accent-sky/40",
          )}
        >
          {renderOption ? renderOption(opt) : null}
          {opt}
        </button>
      ))}
    </div>
  );
}

/** Renders the provider logo (or a colored-initials fallback) to the left of
 *  the option label. Sized for chip-row use — bigger than the listing card
 *  so a user picking their network/bank/insurer can actually see the mark. */
function ProviderChipMark({ name }: { name: string }) {
  // Catch-all sentinel / negative options — never display a logo for these.
  if (/^(i don't|public hospital only|none|other\b)/i.test(name)) return null;
  return <ProviderLogo name={name} size={20} className="max-h-[20px] max-w-[40px]" />;
}

export default function SignupPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<Step>("role");
  const historyRef = useRef<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Corporate/Provider share a free-text org name; Regulator is a closed
  // dropdown (REGULATOR_NAMES) since its self-service safety depends on the
  // name mapping to one specific verified domain (see orgVerification.ts).
  const [organizationName, setOrganizationName] = useState("");
  const [regulatorName, setRegulatorName] = useState<string>("");

  const [ageRange, setAgeRange] = useState("");
  const [occupation, setOccupation] = useState("");
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>([]);

  const [network, setNetwork] = useState("");
  const [planType, setPlanType] = useState("");
  const [spend, setSpend] = useState("");

  // Banking relationships are now multi-select — many Zimbabweans hold
  // accounts at more than one bank (salary at CBZ, EcoCash at Steward, USD
  // nostro at Stanbic, etc.). The "I don't bank" sentinel is exclusive so
  // the account-types follow-up step stays hidden for those users.
  const [banks, setBanks] = useState<string[]>([]);
  // Free-text name captured when "Other" is picked in the banks list — shown
  // as a short inline input above the account-types follow-up. Sent to the
  // API in place of the literal "Other" marker whenever it's filled in.
  const [otherBank, setOtherBank] = useState("");
  const [accountTypes, setAccountTypes] = useState<string[]>([]);
  // Mobile wallets (EcoCash, OneMoney, InnBucks, etc.) are tracked
  // separately from bank account types because they're issued by telecoms /
  // fintechs, not banks, and a user almost always has a wallet *in addition
  // to* a bank account. Optional — pick none is a valid answer.
  const [wallets, setWallets] = useState<string[]>([]);

  // Insurance coverage — multi-select since a user can hold policies
  // with more than one insurer (life at Old Mutual + funeral at ZIMNAT,
  // etc.). "I don't have insurance" is an exclusive sentinel like
  // "I don't bank" — see toggleInsurer() below.
  const [insurers, setInsurers] = useState<string[]>([]);
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);

  // Medical aid coverage — multi-select since a person can belong to more
  // than one scheme (a workplace PSMAS policy plus private family cover at
  // Cimas, etc.). "Public hospital only" and "None" are exclusive sentinels
  // like "I don't bank"/"I don't have insurance" — see toggleMedicalAid().
  const [medicalAids, setMedicalAids] = useState<string[]>([]);
  const [chronicOptIn, setChronicOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [healthDataConsent, setHealthDataConsent] = useState(false);

  const [researchConsent, setResearchConsent] = useState(false);
  const [leaderboardConsent, setLeaderboardConsent] = useState(false);

  const startedProcessing = useRef(false);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  // "I don't bank" is an exclusive sentinel — picking it clears every other
  // bank the user may have already chosen, and picking a real bank while the
  // sentinel is set clears the sentinel first. Keeps the multi-select UX
  // sensible without forcing the user into a separate "are you sure?" step.
  function toggleBank(value: string) {
    if (value === "I don't bank") {
      setBanks((prev) => (prev.includes(value) ? [] : [value]));
      return;
    }
    setBanks((prev) => {
      const withoutSentinel = prev.filter((b) => b !== "I don't bank");
      return withoutSentinel.includes(value)
        ? withoutSentinel.filter((b) => b !== value)
        : [...withoutSentinel, value];
    });
  }

  // Same exclusive-sentinel pattern for insurers. "I don't have insurance"
  // is the uninsured marker; picking it clears any selected insurers, and
  // picking a real insurer clears the sentinel. Mirrors toggleBank() above
  // so the multi-select UX behaves consistently across the two financial
  // steps.
  function toggleInsurer(value: string) {
    if (value === "I don't have insurance") {
      setInsurers((prev) => (prev.includes(value) ? [] : [value]));
      return;
    }
    setInsurers((prev) => {
      const withoutSentinel = prev.filter((i) => i !== "I don't have insurance");
      return withoutSentinel.includes(value)
        ? withoutSentinel.filter((i) => i !== value)
        : [...withoutSentinel, value];
    });
  }

  // Same exclusive-sentinel pattern for medical aids. "None" (no coverage)
  // and "Public hospital only" (no private scheme) are the markers that clear
  // every scheme already chosen; picking a real scheme clears the sentinels
  // first. Mirrors toggleBank()/toggleInsurer() so the multi-select UX behaves
  // consistently across the financial and health steps.
  function toggleMedicalAid(value: string) {
    if (value === "Public hospital only" || value === "None") {
      setMedicalAids((prev) => (prev.includes(value) ? [] : [value]));
      return;
    }
    setMedicalAids((prev) => {
      const withoutSentinel = prev.filter((m) => m !== "Public hospital only" && m !== "None");
      return withoutSentinel.includes(value)
        ? withoutSentinel.filter((m) => m !== value)
        : [...withoutSentinel, value];
    });
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
    if (step !== "processing" || startedProcessing.current) return;
    startedProcessing.current = true;

    (async () => {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        const alreadyRegistered = /already registered|already exists|already been used|taken/i.test(
          signUpError.message,
        );
        setError(
          alreadyRegistered
            ? "This email can only be used once. If you already have an account, please log in instead."
            : signUpError.message,
        );
        setStep("account");
        return;
      }

      const banksSelected = banks.length > 0 && !banks.includes("I don't bank");
      // Replace the "Other" marker with whatever the user typed, if anything
      // — otherwise keep "Other" so the selection still round-trips.
      const finalBanks = banksSelected
        ? banks
            .filter((b) => b !== "Other")
            .concat(otherBank.trim() ? [otherBank.trim()] : banks.includes("Other") ? ["Other"] : [])
        : banks;
      // `insuranceSelected` is true when the user picked at least one real
      // insurer. "I don't have insurance" as the sole selection flips this
      // to false — same shape as the banks step's "I don't bank" sentinel.
      const insuranceSelected =
        insurers.length > 0 && !insurers.includes("I don't have insurance");

      const consents = {
        research_use: researchConsent,
        leaderboard_participation: leaderboardConsent,
        health_data_sharing: healthDataConsent,
      };

      const body =
        role === "corporate"
          ? { role, organizationName, consents }
          : role === "provider"
            ? { role, businessName: organizationName, consents }
            : role === "regulator"
              ? { role, regulatorName, consents }
              : {
                  role: "consumer" as const,
                  fullName,
                  ageRange,
                  occupation,
                  socialPlatforms,
                  telecomFootprint: { primary_network: network, plan_type: planType, monthly_spend_range: spend },
                  bankingFootprint: banksSelected
                    ? { banks: finalBanks, account_types: accountTypes, wallets }
                    : undefined,
                  insuranceFootprint: {
                    providers: insurers,
                    policy_types: insuranceSelected ? policyTypes : [],
                    has_insurance: insuranceSelected,
                  },
                  healthcareFootprint: {
                    medical_aid_providers: medicalAids,
                    chronic_condition_disclosure_opt_in: chronicOptIn,
                  },
                  consents,
                };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(
          res.status === 403 && typeof errBody?.error === "string"
            ? errBody.error
            : errBody?.error
              ? "We couldn't save your profile. Check your email to confirm your account, then log in."
              : "Something went wrong saving your profile.",
        );
        return;
      }

      markHardNav();
      router.push(role === "consumer" ? "/dashboard" : `/${role}`);
      router.refresh();
    })();
  }, [
    step,
    role,
    email,
    password,
    fullName,
    organizationName,
    regulatorName,
    ageRange,
    occupation,
    socialPlatforms,
    network,
    planType,
    spend,
    banks,
    otherBank,
    accountTypes,
    wallets,
    insurers,
    policyTypes,
    medicalAids,
    chronicOptIn,
    healthDataConsent,
    researchConsent,
    leaderboardConsent,
    router,
  ]);

  function canContinue(s: ConsumerStep | "orgDetails") {
    switch (s) {
      case "account":
        return !!(fullName.trim() && email.trim() && password.length >= 6);
      case "personal":
        return !!(ageRange && occupation);
      case "telecom":
        return !!(network && planType && spend);
      case "banking":
        return banks.length > 0;
      case "wallets":
        // Optional step — picking zero wallets is valid (a user may not
        // use mobile money at all, or only use it via the bank-linked
        // services we already capture in the banking step).
        return true;
      case "insurance":
        return insurers.length > 0;
      case "health":
        return medicalAids.length > 0 && termsAccepted;
      case "orgDetails":
        return role === "regulator" ? !!regulatorName : !!organizationName.trim();
      case "consent":
        return true;
    }
  }

  function startProcessing() {
    go("processing");
  }

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 items-center justify-center px-5 py-10">
      <AuthTopBar />
      <div className={clsx("w-full", step === "role" ? "max-w-[960px]" : "max-w-[460px]")}>
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
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRole(option.id)}
                    aria-pressed={selected}
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
              {role === "corporate"
                ? "Use your work email — Corporate accounts can't be verified with a personal address (Gmail, Yahoo, etc)."
                : role === "regulator"
                  ? "Use your official institutional email — it must match the regulator you select next."
                  : "We only use this to secure your account — never shared with providers."}
            </p>
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go(role === "consumer" ? "personal" : "orgDetails")}
                disabled={!canContinue("account")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "orgDetails" && (
          <div className="mt-8 space-y-5">
            {role === "regulator" ? (
              <>
                <h1 className="font-display text-[24px] font-bold">Which regulator?</h1>
                <p className="text-[13px] text-text-secondary">
                  We&apos;ll verify your email matches this institution&apos;s domain.
                </p>
                <div className="flex flex-col gap-2.5">
                  {REGULATORS.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      onClick={() => setRegulatorName(r.name)}
                      aria-pressed={regulatorName === r.name}
                      className={clsx(
                        "tap-target rounded-xl border p-4 text-left transition-all",
                        regulatorName === r.name
                          ? "border-accent-teal bg-accent-teal/[0.08] ring-1 ring-accent-teal/30"
                          : "border-border bg-bg-surface hover:border-accent-teal/40",
                      )}
                    >
                      <div className="text-[14px] font-semibold">{r.name}</div>
                      <p className="mt-0.5 text-[12px] text-text-secondary">{r.fullName}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h1 className="font-display text-[24px] font-bold">
                  {role === "corporate" ? "Your organization" : "Your business"}
                </h1>
                <p className="text-[13px] text-text-secondary">
                  {role === "corporate"
                    ? "The bank, telco, insurer, or hospital you're signing up on behalf of."
                    : "What should shoppers see as your business name?"}
                </p>
                <label className="block">
                  <span className="text-[13px] font-medium text-text-secondary">
                    {role === "corporate" ? "Organization name" : "Business name"}
                  </span>
                  <input
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder={role === "corporate" ? "e.g. CBZ Bank Limited" : "e.g. Tendai's Airtime Kiosk"}
                    className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
                  />
                </label>
                {role === "provider" && (
                  <p className="text-[12px] text-text-muted">
                    Your listings stay unverified until an admin reviews your first submission — this
                    only creates your account.
                  </p>
                )}
              </>
            )}
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("consent")}
                disabled={!canContinue("orgDetails")}
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
            <ChipGroup
              options={NETWORKS}
              value={network}
              onChange={setNetwork}
              renderOption={(opt) => <ProviderChipMark name={opt} />}
            />
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
            <p className="text-[13px] text-text-secondary">
              Pick every bank you hold an account with. We&apos;ll personalize your
              banking comparisons across all of them.
            </p>
            <MultiChipGroup
              options={BANKS}
              values={banks}
              onToggle={toggleBank}
              renderOption={(opt) => <ProviderChipMark name={opt} />}
            />
            {banks.includes("Other") && (
              <div>
                <span className="text-[13px] font-medium text-text-secondary">Other bank name</span>
                <input
                  value={otherBank}
                  onChange={(e) => setOtherBank(e.target.value)}
                  placeholder="Other"
                  autoComplete="off"
                  className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
                />
              </div>
            )}
            {banks.length > 0 && !banks.includes("I don't bank") && (
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
                onClick={() => go("wallets")}
                disabled={!canContinue("banking")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "wallets" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Mobile wallets</h1>
            <p className="text-[13px] text-text-secondary">
              Pick every mobile money or digital wallet you use. We&apos;ll factor
              these into your banking comparisons and fee alerts. Skip if you
              don&apos;t use any.
            </p>
            <MultiChipGroup
              options={WALLETS}
              values={wallets}
              onToggle={(v) => toggle(wallets, setWallets, v)}
            />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("insurance")}
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
            <p className="text-[13px] text-text-secondary">
              Pick every insurer you hold a policy with. We&apos;ll surface their
              products in your comparisons and notify you on price or benefit
              changes. Pick &quot;I don&apos;t have insurance&quot; to skip.
            </p>
            <MultiChipGroup
              options={INSURERS}
              values={insurers}
              onToggle={toggleInsurer}
              renderOption={(opt) => <ProviderChipMark name={opt} />}
            />
            {insurers.length > 0 && !insurers.includes("I don't have insurance") && (
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
            <h1 className="font-display text-[24px] font-bold">Medical Aid</h1>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Select every medical aid scheme you belong to — many Zimbabweans hold more than one
              (a workplace scheme plus family cover, for example). Pick &quot;None&quot; if you have
              no coverage.
            </p>
            <MultiChipGroup
              options={MEDICAL_AIDS}
              values={medicalAids}
              onToggle={toggleMedicalAid}
              renderOption={(opt) => <ProviderChipMark name={opt} />}
            />
            <div>
              <p className="text-[14px] font-semibold">Allow kuwana Team to:</p>
              <label className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
                <input
                  type="checkbox"
                  checked={chronicOptIn}
                  onChange={(e) => setChronicOptIn(e.target.checked)}
                  className="mt-0.5 tap-target"
                />
                <span className="text-[13px] text-text-secondary">
                  Selection optional: I have a chronic condition / I&apos;m a Person with a
                  disability / Prefer not to say.
                </span>
              </label>
              <label className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 tap-target"
                />
                <span className="text-[13px] text-text-secondary">
                  I&apos;ve read the Terms of Service / Privacy Policy Clause and the Terms of Use
                </span>
              </label>
              <label className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
                <input
                  type="checkbox"
                  checked={healthDataConsent}
                  onChange={(e) => setHealthDataConsent(e.target.checked)}
                  className="mt-0.5 tap-target"
                />
                <span className="text-[13px] text-text-secondary">
                  Separately, allow anonymized use of my data to improve Kuwana&apos;s comparisons
                  — distinct from the general research consent on the next screen
                </span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("consent")}
                disabled={!canContinue("health")}
                className="flex-1"
              >
                I Agree &amp; Continue
              </Button>
            </div>
            <p className="text-[11px] italic leading-relaxed text-text-muted">
              By continuing, you agree to let Kuwana process your usage data, product comparisons,
              and account information to refine our algorithms, personalize recommendations, and
              improve app performance. You may withdraw your consent at any time in your account
              settings under the Cyber and Data Protection Act [Chapter 12:07]
            </p>
          </div>
        )}

        {step === "consent" && (
          <div className="mt-8 space-y-4">
            {role === "consumer" ? (
              <>
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
              </>
            ) : (
              <>
                <h1 className="font-display text-[24px] font-bold">Review &amp; create account</h1>
                <div className="rounded-xl border border-border bg-bg-surface p-4 text-[13px]">
                  <p className="text-text-secondary">
                    {role === "regulator" ? "Regulator" : ROLE_OPTIONS.find((r) => r.id === role)?.title}
                  </p>
                  <p className="mt-1 font-semibold">
                    {role === "regulator" ? regulatorName : organizationName}
                  </p>
                </div>
                <p className="text-[12px] text-text-muted">
                  {role === "provider"
                    ? "We'll create your account now — your first listing still goes through admin review before it's visible to shoppers."
                    : "We'll verify your email domain and create your account now."}
                </p>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              {isDesktop ? (
                <WaterButton
                  label={role === "consumer" ? "Save my profile" : "Create account"}
                  onClick={startProcessing}
                  paddingX={0}
                  paddingY={13}
                  rounded={14}
                  style={{ flex: 1 }}
                  waterColor="#3E9BD6"
                  textColor="#ffffff"
                  font={{ fontSize: 14, fontWeight: 600 }}
                  glass={{ tint: "rgba(62, 155, 214, 0.18)", blur: 24, frost: 10 }}
                  borderOptions={{ color: "rgba(62, 155, 214, 0.5)", stroke: 1 }}
                  shadowOptions={{ color: "#141A1F", intensity: 40 }}
                />
              ) : (
                <Button onClick={startProcessing} className="flex-1">
                  {role === "consumer" ? "Save my profile" : "Create account"}
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "processing" && (
          <LoadingFacts title="Saving your profile" subtitle="Getting your comparison scores ready">
            {error && (
              <div className="mt-6 space-y-3">
                <p className="text-[13px] text-accent-coral">{error}</p>
                <Button variant="secondary" onClick={() => router.push("/login")}>
                  Go to login
                </Button>
              </div>
            )}
          </LoadingFacts>
        )}
      </div>
    </div>
  );
}
