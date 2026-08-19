"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { passwordSchema } from "@/lib/authSchema";
import { Button } from "@/components/ui/Button";
import WaterButton from "@/components/ui/WaterButton";
import { Badge } from "@/components/ui/Card";
import { AuthTopBar } from "@/components/AuthTopBar";
import { Turnstile } from "@/components/Turnstile";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { LoadingFacts } from "@/components/loading/LoadingFacts";
import { DynamicBar } from "@/components/ui/DynamicBar";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { FieldError } from "@/components/ui/FieldError";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { markHardNav } from "@/components/SoftNavTracker";
import { Check, User, Building2, Store, Landmark, type LucideIcon } from "lucide-react";
import { AGE_RANGES, OCCUPATIONS, SOCIAL_PLATFORMS } from "@/lib/onboarding-options";
import { REGULATORS } from "@/lib/orgVerification";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { clsx } from "clsx";

type Role = "consumer" | "corporate" | "provider" | "regulator";

// Guarantees the "processing" tunnel reads as an intentional moment rather
// than a flicker: measured from the first time the user hits "Save my
// profile"/"Submit application", not reset by a detour through the
// email-code screen, so a fast (no-mailer) signup still gets the full tunnel
// while one that already spent time waiting on a verification email isn't
// padded further.
const MIN_TUNNEL_MS = 45000;

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
    meta: "Quick setup",
  },
  {
    id: "corporate",
    icon: Building2,
    title: "Corporate",
    desc: "Bank, telco, insurer, or hospital — monitor market intelligence across every sector.",
    bullet: "Work email required",
    meta: "Verified setup",
  },
  {
    id: "provider",
    icon: Store,
    title: "Provider self-service",
    desc: "List and manage your own products or services — a kiosk, an agent, a small business.",
    bullet: "For any business, any size",
    meta: "Verified setup",
  },
  {
    id: "regulator",
    icon: Landmark,
    title: "Regulator",
    desc: "POTRAZ, RBZ, IPEC — monitor compliance and complaints across the market.",
    bullet: "Verified institutional email required",
    meta: "Verified setup",
  },
];

// The consumer wizard used to walk through a long footprint-collection
// questionnaire (personal/telecom/banking/wallets/insurance/health) before
// ever reaching "consent" — that data now lives in the separate, deferred
// /api/footprint editing flow instead, so signup itself stays a 3-step
// "quick setup": consent gate, credentials, optional opt-ins.
const CONSUMER_STEPS = ["dataConsent", "account", "consent"] as const;
type ConsumerStep = (typeof CONSUMER_STEPS)[number];
type Step = "role" | ConsumerStep | "orgDetails" | "industry" | "verification" | "verify" | "processing";

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
          aria-pressed={value === opt}
          className={clsx(
            "tap-target flex items-center gap-2 rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
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
          aria-pressed={values.includes(opt)}
          className={clsx(
            "tap-target flex items-center gap-2 rounded-xl border px-4 py-3 text-[14px] font-medium transition-all",
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
  const isDesktop = useIsDesktop();
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<Step>("role");
  const historyRef = useRef<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Empty when Turnstile isn't configured for this deployment; authorize()
  // (src/lib/nextAuth.ts) treats a missing token as "skip" in that case, so
  // the flow is unchanged. Held in a ref rather than state because
  // createAccount() reads it without wanting it as a dependency.
  const captchaTokenRef = useRef("");
  const setCaptchaToken = (token: string) => {
    captchaTokenRef.current = token;
  };

  // Corporate/Provider share a free-text org name; Regulator is a closed
  // dropdown (REGULATOR_NAMES) since its self-service safety depends on the
  // name mapping to one specific verified domain (see orgVerification.ts).
  const [organizationName, setOrganizationName] = useState("");
  // Optional — shown alongside the business/organization name on its
  // profile once created. Not asked for Regulator, which has no free-text
  // name step to attach it after (its org is a fixed, verified picker).
  const [organizationDescription, setOrganizationDescription] = useState("");
  const [regulatorName, setRegulatorName] = useState<string>("");
  // Corporate-only — which market this account operates in, so Market
  // Intelligence can default to their own sector instead of an unfiltered
  // all-sectors view (see src/app/corporate/page.tsx).
  const [primarySector, setPrimarySector] = useState<SectorSlug | "">("");

  // Folded into the "account" step (consumer only) now that the old
  // dedicated "personal" step is gone — all optional, same as
  // onboardingSchema's consumer branch.
  const [ageRange, setAgeRange] = useState("");
  const [occupation, setOccupation] = useState("");
  const [socialPlatforms, setSocialPlatforms] = useState<string[]>([]);

  // The mandatory pre-signup gate (ToS/Privacy Policy + the Cyber and Data
  // Protection Act [Chapter 12:07] disclosure) — shown to every role on the
  // new "dataConsent" step, right after role selection. Enforced server-side
  // too: /api/auth/register rejects the request without a matching
  // `consentAccepted: true` (see registerSchema in src/lib/authSchema.ts).
  const [consentAccepted, setConsentAccepted] = useState(false);
  // Separate, optional opt-in on the "consent" step — distinct from the
  // mandatory gate above (see the field's own comment in
  // src/lib/onboardingSchema.ts).
  const [healthDataConsent, setHealthDataConsent] = useState(false);

  const [researchConsent, setResearchConsent] = useState(false);
  const [leaderboardConsent, setLeaderboardConsent] = useState(false);

  // Corporate/Provider/Regulator-only "verification" step, reached after
  // orgDetails/industry — a business registration/ID document upload plus
  // an optional custom-dashboard request. Both are optional: applicationStatus
  // is set to "pending" for these roles regardless of whether either was
  // filled in (see /api/onboarding/route.ts).
  const [verificationDocs, setVerificationDocs] = useState<string[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [customInterfaceRequested, setCustomInterfaceRequested] = useState(false);
  const [customInterfaceNotes, setCustomInterfaceNotes] = useState("");

  // The emailed one-time code (see /api/auth/email-verification). Only ever
  // reached when the deployment has a mailer configured — without one the
  // send route answers `verificationRequired: false` and the flow skips
  // straight past the code screen, exactly as it did before this existed.
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // Account creation now happens right after the "account" step (not at the
  // very end) — the later "verification" step needs a real, authenticated
  // user id to attach uploaded documents to (see
  // /api/onboarding/verification-docs). `creatingAccount` disables the
  // account step's Continue button for the duration instead of using a
  // dedicated screen, since it's a sub-second to few-second operation, not
  // the long profile-save tunnel below.
  const [creatingAccount, setCreatingAccount] = useState(false);
  // Profile saving is still a separate one-shot effect (gated on
  // `accountReady` *and* `step === "processing"`) so it stays resumable after
  // an arbitrary pause on the code screen, same reasoning as before — the
  // gate just grew a second condition since account creation and profile
  // saving are no longer adjacent in the step machine.
  const startedProfile = useRef(false);
  const [accountReady, setAccountReady] = useState(false);
  // Which step to land on once the emailed code is confirmed — almost always
  // the step right after "account" (orgDetails/consent), but the profile-save
  // effect below points this at "processing" instead for the rarer case
  // where a mailer got configured between account creation and its own
  // verification check.
  const verifyResumeRef = useRef<Step>("account");
  const processingAnchorRef = useRef<number | null>(null);
  // Set only while the profile-save effect is actually padding out the
  // minimum tunnel duration below — calling it early resolves that wait
  // immediately without touching anything else in-flight.
  const skipTunnelWaitRef = useRef<(() => void) | null>(null);

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

  // The step right after "account" for this role — orgDetails for the three
  // applicant roles (which still need org details / industry / verification
  // before their review step), straight to the optional "consent" opt-ins
  // for consumer, whose flow has nothing else to collect.
  function nextAfterAccount(): Step {
    return role === "consumer" ? "consent" : "orgDetails";
  }

  // Stage one: create the account row, sign in, and ask the server to mail a
  // verification code — triggered directly from the "account" step's
  // Continue button rather than a step-gated effect, since it's a one-shot
  // user action, not something that needs to survive a step transition or
  // re-run on remount.
  //
  // Turnstile is deliberately NOT verified here: a Cloudflare token is
  // single-use, and the sign-in call a few lines down (or the one on the
  // "verify" step's success path) is the one that actually verifies it, via
  // authorize() in src/lib/nextAuth.ts. Checking it twice against Cloudflare
  // would fail the second call. Row creation on its own can't grant a
  // session, so it's an acceptable target to leave unchecked here — it's
  // still bounded by RATE_LIMITS.publicWrite.
  async function createAccount() {
    if (creatingAccount) return;
    setCreatingAccount(true);
    setError(null);

    const registerRes = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // consentAccepted can only be true here because canContinue("account")
      // is only reachable via the "dataConsent" step's own required checkbox
      // — this is the proof /api/auth/register's registerSchema checks for.
      body: JSON.stringify({ email, password, consentAccepted: true }),
    });
    if (!registerRes.ok) {
      const errBody = await registerRes.json().catch(() => ({}));
      setError(
        registerRes.status === 409
          ? "This email can only be used once. If you already have an account, please log in instead."
          : typeof errBody?.error === "string"
            ? errBody.error
            : "Something went wrong creating your account. Please try again.",
      );
      setCreatingAccount(false);
      return;
    }

    // Establish a session right away — this is the direct analogue of
    // Supabase's signUp() minting a session immediately, before its own
    // "email confirmed" state was ever true. Email verification is purely
    // an app-level gate (requireUser(), see src/lib/auth.ts) checked on
    // every subsequent request, not a precondition for having a session at
    // all — that's what lets the send/verify routes below authenticate via
    // the raw session (auth()) while still being blocked by requireUser()
        // everywhere else until the code is confirmed.
    const signInResult = await signIn("credentials", {
      email,
      password,
      turnstileToken: captchaTokenRef.current || undefined,
      redirect: false,
    });
    if (signInResult?.error) {
      setError("Your account was created, but signing you in failed. Please try logging in.");
      setCreatingAccount(false);
      return;
    }

    // Anything short of an explicit `verificationRequired: false` sends the
    // user to the code screen. That is the fail-safe direction: if the mail
    // did go out, skipping the screen would only earn a 403 from
    // /api/onboarding, and if it did not, the resend button on that screen
    // gets the definitive answer and moves on by itself.
    let required = true;
    try {
      const res = await fetch("/api/auth/email-verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (body?.verificationRequired === false) required = false;
      else if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "We couldn't send your verification code. Try requesting a new one.",
        );
      }
    } catch {
      setError("We couldn't reach the server to send your code. Try requesting a new one.");
    }

    setCreatingAccount(false);

    if (required) {
      verifyResumeRef.current = nextAfterAccount();
      setAccountReady(false);
      go("verify");
      return;
    }

    setAccountReady(true);
    // Not go(): "account" was already pushed onto historyRef by whichever
    // call led here (go("verify")'s push, in the code-required path) or,
    // here, this *is* that push — see resumeAfterVerify() below for why the
    // code-required path doesn't push again on its way out of "verify".
    historyRef.current.push("account");
    setStep(nextAfterAccount());
  }

  // Shared by submitCode() and resendCode()'s no-mailer fallback — moves on
  // from the "verify" screen to wherever createAccount() (or the
  // profile-save effect below, on its email_unverified retry) pointed
  // verifyResumeRef at. Deliberately doesn't push onto historyRef itself:
  // go("verify") already pushed the step "verify" was entered from, so
  // back() from the resumed step lands correctly without a second push.
  function resumeAfterVerify() {
    setError(null);
    setAccountReady(true);
    setStep(verifyResumeRef.current);
  }

  // Stage two: save the profile. Gated on `accountReady` *and* on actually
  // being on the "processing" step (not just accountReady, now that account
  // creation happens much earlier in the flow) — otherwise this would fire
  // the moment createAccount() finishes, before any of orgDetails/industry/
  // verification/consent has been filled in.
  useEffect(() => {
    if (!accountReady || step !== "processing" || startedProfile.current) return;
    startedProfile.current = true;

    (async () => {
      const consents = {
        research_use: researchConsent,
        leaderboard_participation: leaderboardConsent,
        health_data_sharing: healthDataConsent,
      };

      // Only meaningful for the three applicant roles — sent as `undefined`
      // fields are simply omitted by JSON.stringify, so this is harmless
      // (and ignored server-side) for consumer, which never spreads it in.
      const applicantFields = {
        verificationDocumentUrls: verificationDocs,
        customInterfaceRequested,
        customInterfaceNotes: customInterfaceNotes.trim() || undefined,
      };

      const body =
        role === "corporate"
          ? {
              role,
              organizationName,
              organizationDescription: organizationDescription.trim() || undefined,
              primarySector,
              consents,
              ...applicantFields,
            }
          : role === "provider"
            ? {
                role,
                businessName: organizationName,
                businessDescription: organizationDescription.trim() || undefined,
                consents,
                ...applicantFields,
              }
            : role === "regulator"
              ? { role, regulatorName, consents, ...applicantFields }
              : {
                  // Footprint fields (telecom/banking/insurance/healthcare)
                  // are deliberately omitted, not sent as empty/undefined —
                  // they're all `.optional()` in onboardingSchema, and that
                  // data is now only ever collected later via the separate
                  // /api/footprint editing flow, not at signup.
                  role: "consumer" as const,
                  username,
                  ageRange,
                  occupation,
                  socialPlatforms,
                  consents,
                };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        // The server refused because this signup never confirmed its code —
        // reachable if the mailer was switched on between account creation
        // and here, or if the code was consumed against a different
        // address. Put the user back on the code screen instead of a dead
        // end, and resume straight back to "processing" (not the step after
        // "account") once they get through it, since the profile answers
        // are already collected.
        if (errBody?.reason === "email_unverified") {
          startedProfile.current = false;
          setAccountReady(false);
          verifyResumeRef.current = "processing";
          setStep("verify");
          setError(null);
          return;
        }
        setError(
          res.status === 403 && typeof errBody?.error === "string"
            ? errBody.error
            : errBody?.error
              ? "We couldn't save your profile. Please try logging in and completing your profile again."
              : "Something went wrong saving your profile.",
        );
        return;
      }

      const anchor = processingAnchorRef.current ?? Date.now();
      const remaining = MIN_TUNNEL_MS - (Date.now() - anchor);
      if (remaining > 0) {
        await new Promise<void>((resolve) => {
          skipTunnelWaitRef.current = resolve;
          setTimeout(resolve, remaining);
        });
        skipTunnelWaitRef.current = null;
      }

      markHardNav();
      router.push(role === "consumer" ? "/dashboard" : `/${role}`);
      router.refresh();
    })();
  }, [
    accountReady,
    step,
    role,
    username,
    organizationName,
    organizationDescription,
    regulatorName,
    primarySector,
    ageRange,
    occupation,
    socialPlatforms,
    healthDataConsent,
    researchConsent,
    leaderboardConsent,
    verificationDocs,
    customInterfaceRequested,
    customInterfaceNotes,
    router,
  ]);

  function accountFieldErrors(): { username: string | null; email: string | null; password: string | null } {
    return {
      username:
        username && !/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())
          ? "Use 3–20 letters, numbers, or underscores only."
          : null,
      email: email && !email.includes("@") ? "Email must include an @ symbol." : null,
      password: password ? (passwordSchema.safeParse(password).error?.issues[0]?.message ?? null) : null,
    };
  }

  function canContinue(s: ConsumerStep | "orgDetails" | "industry" | "verification") {
    switch (s) {
      case "dataConsent":
        return consentAccepted;
      case "account":
        return !!(
          /^[a-zA-Z0-9_]{3,20}$/.test(username.trim()) &&
          email.trim() &&
          passwordSchema.safeParse(password).success
        );
      case "orgDetails":
        return role === "regulator" ? !!regulatorName : !!organizationName.trim();
      case "industry":
        return !!primarySector;
      case "verification":
        // Both the document upload and the custom-interface request are
        // optional — applicationStatus is set to "pending" either way.
        return true;
      case "consent":
        return true;
    }
  }

  function skipTunnel() {
    skipTunnelWaitRef.current?.();
  }

  function startProcessing() {
    processingAnchorRef.current = Date.now();
    go("processing");
  }

  async function submitCode() {
    setVerifying(true);
    setError(null);
    setResendNotice(null);
    try {
      const res = await fetch("/api/auth/email-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "That code isn't right.");
        return;
      }
      resumeAfterVerify();
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function resendCode() {
    setError(null);
    setResendNotice(null);
    try {
      const res = await fetch("/api/auth/email-verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      // The deployment turns out to have no mailer after all — stage one only
      // landed here because it could not get a definitive answer. Carry on
      // rather than leaving the user waiting for mail nobody is sending.
      if (body?.verificationRequired === false) {
        resumeAfterVerify();
        return;
      }
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "We couldn't send a new code.");
        return;
      }
      setCode("");
      setResendNotice("We've sent a new code — check your inbox.");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    }
  }

  async function handleVerificationDocChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingDoc(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding/verification-docs", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body?.error === "string" ? body.error : "Upload failed — please try again.");
        return;
      }
      setVerificationDocs((prev) => [...prev, body.url]);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setUploadingDoc(false);
    }
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
              <Button onClick={() => go("dataConsent")} disabled={!role}>
                Continue →
              </Button>
            </div>
          </div>
        )}

        {step === "dataConsent" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Before you continue</h1>
            <p className="text-[13px] text-text-secondary">
              {role === "consumer"
                ? "A quick check before we set up your account."
                : "A quick check before we set up and verify your account."}
            </p>
            <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 tap-target"
              />
              <span className="text-[13px] text-text-secondary">
                I&apos;ve read the Terms of Service / Privacy Policy Clause and the Terms of Use
              </span>
            </label>
            <p className="text-[11px] italic leading-relaxed text-text-muted">
              By continuing, you agree to let Kuwana process your usage data, product comparisons,
              and account information to refine our algorithms, personalize recommendations, and
              improve app performance. You may withdraw your consent at any time in your account
              settings under the Cyber and Data Protection Act [Chapter 12:07]
            </p>
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => go("account")}
                disabled={!canContinue("dataConsent")}
                className="flex-1"
              >
                I Agree &amp; Continue
              </Button>
            </div>
          </div>
        )}

        {step === "account" && (
          <div className="mt-8 space-y-4">
            <h1 className="font-display text-[24px] font-bold">Create your account</h1>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Username</span>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
                title="Letters, numbers, and underscores only"
                placeholder="e.g. tendai_m"
                aria-invalid={!!accountFieldErrors().username}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
              />
              {accountFieldErrors().username ? (
                <FieldError error={accountFieldErrors().username} />
              ) : (
                <span className="mt-1 block text-[12px] text-text-muted">
                  This is your unique ID on Kuwana — letters, numbers, and underscores only.
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Email</span>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!accountFieldErrors().email}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
              />
              <FieldError error={accountFieldErrors().email} />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">
                Password (min 6 characters)
              </span>
              <PasswordInput
                required
                minLength={6}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!accountFieldErrors().password}
                className="mt-1.5"
              />
              <FieldError error={accountFieldErrors().password} />
            </label>
            <p className="text-[12px] text-text-muted">
              {role === "corporate"
                ? "Use your work email — Corporate accounts can't be verified with a personal address (Gmail, Yahoo, etc)."
                : role === "regulator"
                  ? "Use your official institutional email — it must match the regulator you select next."
                  : "We only use this to secure your account — never shared with providers."}
            </p>
            {role === "consumer" && (
              <>
                <div>
                  <span className="text-[13px] font-medium text-text-secondary">
                    Age range <span className="text-text-muted">(optional)</span>
                  </span>
                  <div className="mt-2">
                    <ChipGroup options={AGE_RANGES} value={ageRange} onChange={setAgeRange} />
                  </div>
                </div>
                <div>
                  <span className="text-[13px] font-medium text-text-secondary">
                    Occupation <span className="text-text-muted">(optional)</span>
                  </span>
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
              </>
            )}
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            {/* Solved here rather than on the final step: the token is
                short-lived and single-use, so challenging immediately before
                the account is actually created would mean re-challenging
                anyone who spends time on the profile questions. */}
            <Turnstile onToken={setCaptchaToken} />
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button
                onClick={createAccount}
                disabled={!canContinue("account") || creatingAccount}
                className="flex-1"
              >
                {creatingAccount ? "Creating account…" : "Continue"}
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
                    required
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder={role === "corporate" ? "e.g. CBZ Bank Limited" : "e.g. Tendai's Airtime Kiosk"}
                    className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-medium text-text-secondary">
                    Short description <span className="text-text-muted">(optional)</span>
                  </span>
                  <textarea
                    value={organizationDescription}
                    onChange={(e) => setOrganizationDescription(e.target.value)}
                    placeholder={
                      role === "corporate"
                        ? "e.g. Zimbabwe's largest commercial bank, offering savings, loans, and business banking."
                        : "e.g. Affordable airtime, data bundles, and mobile money top-ups in Mbare."
                    }
                    maxLength={300}
                    rows={3}
                    className="mt-1.5 w-full resize-none rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
                  />
                </label>
                {role === "provider" && (
                  <p className="text-[12px] text-text-muted">
                    Your listings stay unverified until an admin reviews your first submission.
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
                onClick={() => go(role === "corporate" ? "industry" : "verification")}
                disabled={!canContinue("orgDetails")}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "industry" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Which industry are you in?</h1>
            <p className="text-[13px] text-text-secondary">
              We&apos;ll default your Market Intelligence dashboard to this sector — you can still
              switch to any other sector any time.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {LIVE_SECTORS.map((slug) => {
                const sector = SECTORS[slug];
                const selected = primarySector === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setPrimarySector(slug)}
                    aria-pressed={selected}
                    className={clsx(
                      "tap-target flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
                      selected
                        ? "border-accent-teal bg-accent-teal/[0.08] ring-1 ring-accent-teal/30"
                        : "border-border bg-bg-surface hover:border-accent-teal/40",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        selected ? "bg-accent-teal/15 text-accent-teal" : "bg-bg-surface-raised text-text-secondary",
                      )}
                    >
                      <sector.icon size={17} strokeWidth={1.75} />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold">{sector.name}</div>
                      <p className="text-[11.5px] text-text-secondary">{sector.blurb}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={() => go("verification")} disabled={!canContinue("industry")} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "verification" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Verify your organization</h1>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Upload a business registration document or ID so our team can review your account.
              This is optional, and your account is fully usable right away either way — it only
              speeds up review.
            </p>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Verification document</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleVerificationDocChange}
                disabled={uploadingDoc}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-[13px] text-text-secondary outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-accent-sky/15 file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-accent-sky"
              />
              {uploadingDoc && <span className="mt-1 block text-[12px] text-text-muted">Uploading…</span>}
            </label>
            {verificationDocs.length > 0 && (
              <ul className="space-y-1 text-[12px] text-accent-teal">
                {verificationDocs.map((url, i) => (
                  <li key={url}>Document {i + 1} uploaded ✓</li>
                ))}
              </ul>
            )}
            <div>
              <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
                <input
                  type="checkbox"
                  checked={customInterfaceRequested}
                  onChange={(e) => setCustomInterfaceRequested(e.target.checked)}
                  className="mt-0.5 tap-target"
                />
                <span className="text-[13px] text-text-secondary">
                  I&apos;d like to apply for a custom dashboard/interface for my organization.
                </span>
              </label>
              {customInterfaceRequested && (
                <textarea
                  value={customInterfaceNotes}
                  onChange={(e) => setCustomInterfaceNotes(e.target.value)}
                  placeholder="Tell us what you'd need — we'll follow up by email."
                  maxLength={1000}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-xl border border-border bg-bg-surface px-4 py-3 text-[15px] outline-none focus:border-accent-sky"
                />
              )}
            </div>
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              <Button onClick={() => go("consent")} disabled={uploadingDoc} className="flex-1">
                Continue
              </Button>
            </div>
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
                <label className="flex items-start gap-3 rounded-xl border border-border bg-bg-surface p-4">
                  <input
                    type="checkbox"
                    checked={healthDataConsent}
                    onChange={(e) => setHealthDataConsent(e.target.checked)}
                    className="mt-0.5 tap-target"
                  />
                  <span className="text-[13px] text-text-secondary">
                    Separately, allow anonymized use of any health-related data I add later to
                    improve Kuwana&apos;s comparisons.
                  </span>
                </label>
                <p className="text-[12px] text-text-muted">
                  You can change any of these settings anytime in Settings.
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-[24px] font-bold">Review &amp; submit</h1>
                <div className="rounded-xl border border-border bg-bg-surface p-4 text-[13px]">
                  <p className="text-text-secondary">
                    {role === "regulator" ? "Regulator" : ROLE_OPTIONS.find((r) => r.id === role)?.title}
                  </p>
                  <p className="mt-1 font-semibold">
                    {role === "regulator" ? regulatorName : organizationName}
                  </p>
                  {role === "corporate" && primarySector && (
                    <p className="mt-1 text-text-secondary">{SECTORS[primarySector].name}</p>
                  )}
                  {verificationDocs.length > 0 && (
                    <p className="mt-1 text-text-secondary">
                      {verificationDocs.length} verification document(s) uploaded
                    </p>
                  )}
                </div>
                <p className="text-[12px] text-text-muted">
                  {role === "provider"
                    ? "We'll save your profile now and queue your application for review — your first listing still goes through admin review before it's visible to shoppers."
                    : "We'll verify your email domain, save your profile, and queue your application for review."}
                </p>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={back} className="flex-1">
                Back
              </Button>
              {isDesktop ? (
                <WaterButton
                  label={role === "consumer" ? "Save my profile" : "Submit application"}
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
                  {role === "consumer" ? "Save my profile" : "Submit application"}
                </Button>
              )}
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="mt-8 space-y-5">
            <h1 className="font-display text-[24px] font-bold">Check your email</h1>
            <p className="text-[14px] leading-relaxed text-text-secondary">
              We sent a 6-digit code to <span className="font-semibold text-text-primary">{email}</span>.
              Enter it below to finish creating your account.
            </p>
            <label className="block">
              <span className="text-[13px] font-medium text-text-secondary">Verification code</span>
              <input
                value={code}
                // `one-time-code` is what lets iOS and Android offer the code
                // straight from the notification, and the numeric inputMode
                // brings up a digits keypad instead of a full keyboard.
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                placeholder="000000"
                aria-label="6-digit verification code"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6 && !verifying) void submitCode();
                }}
                className="mt-1.5 w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-center font-mono text-[24px] tracking-[0.4em] outline-none focus:border-accent-sky"
              />
            </label>
            <p className="text-[12px] text-text-muted">
              The code expires in 10 minutes and can only be used once.
            </p>
            {error && <p className="text-[13px] text-accent-coral">{error}</p>}
            {resendNotice && <p className="text-[13px] text-accent-teal">{resendNotice}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={resendCode} disabled={verifying} className="flex-1">
                Send a new code
              </Button>
              <Button onClick={submitCode} disabled={code.length !== 6 || verifying} className="flex-1">
                {verifying ? "Checking…" : "Verify"}
              </Button>
            </div>
          </div>
        )}

        {step === "processing" && (
          <LoadingFacts
            title="Saving your profile"
            subtitle="Getting your comparison scores ready"
            onSkip={skipTunnel}
          >
            <ProgressSteps
              className="mt-6 max-w-[260px]"
              steps={[
                {
                  key: "profile",
                  label: "Saving your profile",
                  state: error ? "error" : "active",
                },
              ]}
            />
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
