import Image from "next/image";
import Link from "next/link";
import { Lightbulb, Scale, Fingerprint, Sparkles } from "lucide-react";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";
import { SignalBloom } from "@/components/SignalBloom";
import { LandingFXLazy, HeroDeviceMockupLazy } from "@/components/landing/LandingHeroLazy";
import { ScrollButtons } from "@/components/landing/ScrollButtons";
import { GetStartedButton } from "@/components/landing/GetStartedButton";
import { ComingSoonWaitlist } from "@/components/landing/ComingSoonWaitlist";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LinkButton } from "@/components/ui/Button";
import Typewriter from "@/components/ui/Typewriter";

const WEEKLY_PICKS = [
  { title: "Best value data bundles this week", sub: "Econet · NetOne · Telecel", score: 92 },
  { title: "Savings accounts with the lowest fees", sub: "CBZ · Steward · FBC · Nedbank", score: 87 },
  { title: "Motor cover that actually pays out fast", sub: "Old Mutual · ZIMNAT · Fidelity Life", score: 81 },
];

const FEATURES = [
  {
    icon: Lightbulb,
    title: "Explainable recommendations",
    description:
      "Every suggestion comes with the reasoning behind it — cost, benefit, and how it beat the alternatives — so you decide with the full picture, not a black box.",
  },
  {
    icon: Scale,
    title: "Total-cost, eligibility-aware",
    description:
      "We weigh price against what you actually get, and check what you're eligible for first. Not just the cheapest option — the best fit for you.",
  },
  {
    icon: Fingerprint,
    title: "One footprint, every sector",
    description:
      "Tell us once what you already have — network, bank, cover — and every comparison after that is weighted around your real situation.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section
          id="landing-hero-fx"
          className="relative isolate px-5 pt-6 md:px-10 md:pt-10"
        >
          <LandingFXLazy containerId="landing-hero-fx" />

          <div className="relative mx-auto flex max-w-[1120px] flex-col items-center gap-10 md:flex-row md:items-center md:gap-8">
            <div className="w-full md:max-w-[520px]">
              <span
                data-scan
                className="inline-flex items-center gap-1.5 rounded-full border border-accent-sky/30 bg-accent-sky/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-sky"
              >
                <Sparkles size={12} />
                AI-assisted comparisons for Zimbabwe
              </span>

              <h1 className="mt-4 flex flex-wrap items-baseline gap-x-2 font-display text-[32px] leading-[1.05] font-bold tracking-tight md:text-[46px]">
                <span className="w-full">Compare smarter.</span>
                <Typewriter
                  texts={["Gain", "See", "Save", "Live", "Compare", "Kuwana", "Earn"]}
                  typedColor="var(--accent-teal)"
                  cursorColor="var(--accent-teal)"
                  ease={{ type: "tween", duration: 0.04, delay: 3.5, ease: "easeInOut" }}
                  deleteSpeed={0.03}
                  font={{
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    fontWeight: "inherit",
                    lineHeight: "inherit",
                    letterSpacing: "inherit",
                  }}
                  style={{ width: "auto", height: "auto", display: "inline-flex" }}
                />
                <span>more.</span>
              </h1>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-text-secondary">
                Explainable, total-cost, eligibility-aware comparisons across telecom, banking,
                insurance and more — not just the cheapest option, the best fit.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <GetStartedButton />
                <LinkButton href="/login" variant="ghost" size="lg">
                  Log in
                </LinkButton>
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
                <FeatureStripItem
                  title="AI recommendations"
                  desc="Personalised to your footprint"
                />
                <FeatureStripItem title="Live listings" desc="Comparisons reflect current pricing" />
                <FeatureStripItem title="Transparent scoring" desc="See exactly why one option won" />
              </div>
            </div>

            <div className="w-full md:flex-1">
              <HeroDeviceMockupLazy />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-[1120px] px-5 py-10 md:px-10">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-text-muted">
            What you get
          </span>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 transition-shadow hover:shadow-[0_0_28px_-10px_var(--accent-teal)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-teal/10 text-accent-teal">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-3 font-display text-[16px] font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-[1.55] text-text-secondary">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-10 md:px-10">
          <h2 className="font-display text-[20px] font-semibold">This week&apos;s picks</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {WEEKLY_PICKS.map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 transition-shadow hover:shadow-[0_0_28px_-10px_var(--accent-teal)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold text-[16px] leading-[1.2]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[12px] text-text-muted">{item.sub}</p>
                  </div>
                  <SignalBloom value={item.score} size={52} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-10 md:px-10">
          <h2 className="font-display text-[20px] font-semibold mb-4">One app, every sector</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Object.values(SECTORS).map((sector) => {
              const Icon = sector.icon;
              const live = LIVE_SECTORS.includes(sector.slug);
              return live ? (
                <Link
                  key={sector.slug}
                  href={`/explore/${sector.slug}`}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 text-center transition-all hover:border-accent-sky/50 hover:shadow-[0_0_24px_-10px_var(--accent-teal)]"
                >
                  <Icon size={28} className="text-accent-teal" />
                  <span className="font-medium text-[13px]">{sector.name}</span>
                  <span className="text-[11px] text-text-muted">{sector.blurb}</span>
                </Link>
              ) : (
                <div
                  key={sector.slug}
                  aria-disabled="true"
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 text-center opacity-55"
                >
                  <Icon size={28} className="text-text-muted" />
                  <span className="font-medium text-[13px] text-text-muted">{sector.name}</span>
                  <span className="rounded-full border border-border bg-bg-base px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Coming soon
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-10 md:px-10">
          <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface-raised p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4">
            <Sparkles size={32} className="text-accent-teal shrink-0" />
            <div className="flex-1">
              <h2 className="font-display text-[18px] font-semibold">Seven sectors, live today</h2>
              <p className="mt-1 text-[13px] text-text-secondary max-w-[48ch]">
                Compare Telecom, Banking, Insurance, Education, Transport, Utilities and Pharmacy
                — with Healthcare, Hotels, Retail &amp; Groceries and more on the way.
              </p>
            </div>
            <Link
              href="/explore"
              className="rounded-full bg-accent-teal px-5 py-2 text-[13px] font-semibold text-bg-base transition-opacity hover:opacity-90"
            >
              Start comparing
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="partners-heading"
          className="mx-auto max-w-[1120px] px-5 pb-16 md:px-10"
        >
          <h2
            id="partners-heading"
            className="text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
          >
            Partners
          </h2>
          <div className="mt-4 -mx-5 overflow-x-auto px-5 md:mx-0 md:overflow-visible md:px-0">
            <ul className="flex flex-row items-center justify-start gap-8 md:justify-center md:gap-16 min-w-max md:min-w-0">
              <li className="shrink-0">
                <Image
                  src="/aiia-logo.png"
                  alt="Ai Institute Africa"
                  width={488}
                  height={409}
                  className="h-[50px] w-auto md:h-[60px]"
                  priority={false}
                />
              </li>
              <li className="shrink-0">
                <Image
                  src="/kuwana-mark.png"
                  alt="Kuwana"
                  width={240}
                  height={240}
                  className="h-[50px] w-[50px] md:h-[60px] md:w-[60px]"
                  priority={false}
                />
              </li>
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 pb-16 md:px-10">
          <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface-raised p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-[22px] font-semibold">Coming soon — join the waitlist</h2>
              <p className="mt-1 text-[14px] text-text-secondary max-w-[48ch]">
                Healthcare, Tech &amp; Electronics, Clothes, Hotels, and Retail &amp; Groceries are on
                the way. Pick a category and we&apos;ll email you the moment it launches.
              </p>
            </div>
            <ComingSoonWaitlist />
          </div>
        </section>
      </main>

      <LandingFooter />

      <ScrollButtons />
    </div>
  );
}

function FeatureStripItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-2 text-center md:justify-start md:text-left">
      <span className="text-[13px] font-semibold text-text-primary">{title}</span>
      <span className="text-[12px] text-text-muted">— {desc}</span>
    </div>
  );
}
