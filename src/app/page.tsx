import Image from "next/image";
import Link from "next/link";
import { Lightbulb, Scale, Fingerprint, Sparkles, HeartPulse } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackToTopButton } from "@/components/landing/BackToTopButton";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";
import { SignalBloom } from "@/components/SignalBloom";
import { LandingFXLazy, HeroDeviceMockupLazy } from "@/components/landing/LandingHeroLazy";
import { ScrollButtons } from "@/components/landing/ScrollButtons";
import { WaitlistInline } from "@/components/landing/WaitlistInline";
import { GetStartedButton } from "@/components/landing/GetStartedButton";

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
      <header className="flex items-center justify-between px-5 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <Image src="/kuwana-mark.png" alt="" width={28} height={28} />
          <span className="font-display text-xl font-bold tracking-tight">kuwana.ai</span>
        </div>
        <nav className="flex items-center gap-3">
          <ThemeToggle />
          <LinkButton href="/login" variant="ghost" size="md">
            Log in
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="md">
            Get started
          </LinkButton>
        </nav>
      </header>

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

              <h1 className="mt-4 font-display text-[32px] leading-[1.05] font-bold tracking-tight md:text-[46px]">
                Compare smarter. <span className="text-accent-sky">Gain</span> more.
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
                  desc="Claude-explained, personalised to your footprint"
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
          <h2 className="font-display text-[20px] font-semibold mb-4">One app, every sector</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Object.values(SECTORS).map((sector) => {
              const Icon = sector.icon;
              const live = LIVE_SECTORS.includes(sector.slug);
              return (
                <Link
                  key={sector.slug}
                  href={live ? `/explore/${sector.slug}` : `/explore/healthcare`}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 text-center transition-all hover:border-accent-sky/50 hover:shadow-[0_0_24px_-10px_var(--accent-teal)]"
                >
                  <Icon size={28} className="text-accent-teal" />
                  <span className="font-medium text-[13px]">{sector.name}</span>
                  <span className="text-[11px] text-text-muted">
                    {live ? sector.blurb : "Coming soon"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-10 md:px-10">
          <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface-raised p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-4">
            <HeartPulse size={32} className="text-accent-coral shrink-0" />
            <div className="flex-1">
              <h2 className="font-display text-[18px] font-semibold">Healthcare is coming next</h2>
              <p className="mt-1 text-[13px] text-text-secondary max-w-[48ch]">
                Explainable comparisons for medical aid, clinics and pharmacies. Join the waitlist
                to be first to know.
              </p>
            </div>
            <WaitlistInline />
          </div>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 pb-16 md:px-10">
          <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface-raised p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-[22px] font-semibold">
                Browse now, sign up when you&apos;re ready
              </h2>
              <p className="mt-1 text-[14px] text-text-secondary max-w-[48ch]">
                Explore listings without an account. Create one to compare, save, and get
                AI-explained recommendations.
              </p>
            </div>
            <LinkButton href="/explore/telecom" variant="secondary" size="lg">
              Start exploring
            </LinkButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-10 md:px-10">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-[36ch]">
            <div className="flex items-center gap-2">
              <Image src="/kuwana-mark.png" alt="" width={22} height={22} />
              <span className="font-display text-[15px] font-bold tracking-tight">kuwana.ai</span>
            </div>
            <p className="mt-2 text-[12px] leading-[1.6] text-text-muted">
              Explainable comparisons for the decisions that actually matter.
            </p>
          </div>

          <div className="flex gap-10">
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Product
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-text-secondary">
                <li>
                  <a href="#features" className="hover:text-text-primary">
                    Features
                  </a>
                </li>
                <li>
                  <Link href="/explore" className="hover:text-text-primary">
                    Explore
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Account
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-text-secondary">
                <li>
                  <Link href="/login" className="hover:text-text-primary">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-text-primary">
                    Get started
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Trust
              </h4>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-text-secondary">
                <li>
                  <Link href="/trust" className="hover:text-text-primary">
                    Our promises
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 flex max-w-[1120px] flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-text-muted">
            Kuwana — comparisons are AI-assisted and reference seed/mock listing data in this MVP.
          </p>
          <BackToTopButton />
        </div>
      </footer>

      <ScrollButtons />
    </div>
  );
}

function FeatureStripItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[13px] font-semibold text-text-primary">{title}</span>
      <span className="text-[12px] text-text-muted">— {desc}</span>
    </div>
  );
}
