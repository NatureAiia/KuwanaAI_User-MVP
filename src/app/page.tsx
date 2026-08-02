import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";
import { SignalBloom } from "@/components/SignalBloom";

const HERO_ITEMS = [
  { title: "Best value data bundles this week", sub: "Econet · NetOne · Telecel", score: 92 },
  { title: "Savings accounts with the lowest fees", sub: "CBZ · Steward · FBC · Nedbank", score: 87 },
  { title: "Motor cover that actually pays out fast", sub: "Old Mutual · ZIMNAT · Fidelity Life", score: 81 },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-4 md:px-10">
        <span className="font-display text-xl font-bold tracking-tight">kuwana</span>
        <nav className="flex items-center gap-3">
          <LinkButton href="/login" variant="ghost" size="md">
            Log in
          </LinkButton>
          <LinkButton href="/signup" variant="primary" size="md">
            Get started
          </LinkButton>
        </nav>
      </header>

      <main className="flex-1 px-5 md:px-10">
        <section className="mx-auto max-w-[1120px] pt-6 md:pt-12">
          <h1 className="font-display text-[32px] leading-[1.05] font-bold tracking-tight md:text-[48px] max-w-[16ch]">
            Compare smarter. <span className="text-accent-gold">Gain</span> more.
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-text-secondary">
            Explainable, total-cost, eligibility-aware comparisons across telecom, banking,
            insurance and education in Zimbabwe — not just the cheapest option, the best fit.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {HERO_ITEMS.map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5"
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

        <section className="mx-auto max-w-[1120px] py-10">
          <h2 className="font-display text-[20px] font-semibold mb-4">One app, every sector</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Object.values(SECTORS).map((sector) => {
              const Icon = sector.icon;
              const live = LIVE_SECTORS.includes(sector.slug);
              return (
                <Link
                  key={sector.slug}
                  href={live ? `/explore/${sector.slug}` : `/explore/healthcare`}
                  className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 text-center hover:border-accent-gold/50 transition-all"
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

        <section className="mx-auto max-w-[1120px] pb-16">
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

      <footer className="px-5 py-6 text-center text-[12px] text-text-muted md:px-10">
        Kuwana — comparisons are AI-assisted and reference seed/mock listing data in this MVP.
      </footer>
    </div>
  );
}
