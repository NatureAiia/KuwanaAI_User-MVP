import type { Metadata } from "next";
import { Eye, ShieldCheck, Ban, Accessibility, Lock, FlaskConical } from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { BackButton } from "@/components/ui/BackButton";
import { Accordion } from "@/components/ui/Accordion";

const LAST_UPDATED = "August 2026";

const FAQ_ITEMS = [
  {
    question: "Does Kuwana get paid by the providers it compares?",
    answer:
      "Some providers pay for placement or advertising, but that never changes the ranking logic itself — sponsored listings are always labelled, and the underlying comparison uses the same explainable rules for every provider.",
  },
  {
    question: "How often is listing data refreshed?",
    answer:
      "Prices and eligibility rules are re-checked on a rolling basis; provider-submitted listings go through review before they go live, and any correction is reflected as soon as it's approved.",
  },
  {
    question: "What happens to my data if I close my account?",
    answer:
      "Closing an account takes the same number of steps as opening one. Your personal data is removed according to our retention policy, and nothing is kept just to make you harder to leave.",
  },
  {
    question: "Who do I contact if I spot something wrong?",
    answer:
      "Use the report option on any listing, or reach out through Settings → Support. Regulator and provider accounts have their own escalation paths for disputes.",
  },
] as const;

export const metadata: Metadata = {
  title: "Trust & Transparency — Kuwana",
  description:
    "The promises behind every Kuwana comparison: explainable recommendations, no invented statistics, no dark patterns, and accessibility built in from the start.",
};

const PROMISES = [
  {
    icon: Eye,
    title: "We explain every option, not just the winner",
    description:
      "Every result comes with the reasoning behind it — cost, benefit, and eligibility. Runner-up options get the same treatment as our top pick, never a black-box “recommended for you.”",
  },
  {
    icon: ShieldCheck,
    title: "We don't invent statistics",
    description:
      "No fabricated trivia, no made-up scores, no numbers pulled from nowhere — including the small stuff, like onboarding tips. Every figure you see traces back to real listing or eligibility data.",
  },
  {
    icon: Ban,
    title: "No dark patterns",
    description:
      "No fake countdowns. No “only 2 left” without a real number behind it. Signing up and closing an account take the same number of steps.",
  },
  {
    icon: Accessibility,
    title: "Built to WCAG 2.1 AA",
    description:
      "44px minimum tap targets, full keyboard navigation, and animations that respect your device's reduced-motion setting — sitewide, not just the homepage.",
  },
  {
    icon: Lock,
    title: "Locked down by default",
    description:
      "Camera, microphone, and location access are blocked unless a feature explicitly needs them. Strict transport security and a locked-down content policy apply to every page, not just login.",
  },
  {
    icon: FlaskConical,
    title: "Honest about what's still MVP",
    description:
      "Some of what you see right now is seed data while we onboard real Zimbabwean providers. We'll always tell you when that's the case — not bury it in a footer line.",
  },
];

export default function TrustPage() {
  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />

      <div className="mt-4 flex items-center gap-2">
        <BackButton fallbackHref="/settings" />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
          How Kuwana works
        </span>
      </div>
      <h1 className="mt-2 font-display text-[26px] font-bold md:text-[32px]">
        The promises behind every comparison
      </h1>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.6] text-text-secondary">
        Kuwana was built as a decision-intelligence platform, not a marketplace. These are the
        rules that stay true whether you notice them or not.
      </p>
      <p className="mt-2 text-[12px] text-text-muted">Last updated {LAST_UPDATED}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PROMISES.map((promise) => {
          const Icon = promise.icon;
          return (
            <div
              key={promise.title}
              className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-teal/10 text-accent-teal">
                <Icon size={20} />
              </div>
              <h2 className="mt-3 font-display text-[16px] font-semibold">{promise.title}</h2>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-text-secondary">
                {promise.description}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 font-display text-[20px] font-bold">Frequently asked questions</h2>
      <div className="mt-4">
        <Accordion items={FAQ_ITEMS} />
      </div>

      <BottomTabBar />
    </div>
  );
}
