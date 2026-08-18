import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";

// See src/app/page.tsx for why this route must opt out of static rendering.
export const dynamic = "force-dynamic";

const TEAM_MEMBERS = [
  {
    name: "Placeholder 1",
    role: "Position 1",
    position: "Aiia",
  },
  {
    name: "Placeholder 2",
    role: "Position 2",
    position: "Aiia",
  },
  {
    name: "Placeholder 3",
    role: "Position 3",
    position: "Aiia",
  },
  {
    name: "Placeholder 4",
    role: "Position 4",
    position: "Aiia",
  },
  {
    name: "Placeholder 5",
    role: "Position 5",
    position: "Aiia",
  },
];

export const metadata: Metadata = {
  title: "Team — Kuwana",
  description: "kuwana.ai proudly brought to you by Aiia",
};

export default function TeamPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LandingHeader />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="mx-auto max-w-[1120px] px-5 pt-10 pb-6 md:px-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-sky/30 bg-accent-sky/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-sky">
            <Sparkles size={12} />
            Meet the people behind Kuwana
          </span>
          <h1 className="mt-4 font-display text-[32px] font-bold tracking-tight md:text-[46px]">
            Team
          </h1>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-text-secondary">
            kuwana.ai proudly brought to you by Aiia
          </p>
        </section>

        <section className="mx-auto max-w-[1120px] px-5 py-10 md:px-10">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 text-center transition-shadow hover:shadow-[0_0_28px_-10px_var(--accent-teal)]"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-teal/10 text-accent-teal">
                  <span className="text-[22px] font-semibold">{member.name.charAt(0)}</span>
                </div>
                <h3 className="font-display text-[16px] font-semibold text-text-primary">
                  {member.name}
                </h3>
                <p className="text-[12px] text-text-secondary">{member.role}</p>
                <p className="text-[11px] text-text-muted">{member.position}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
