import Link from "next/link";
import type { Metadata } from "next";
import { clsx } from "clsx";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { NeedIntake } from "@/components/explore/NeedIntake";
import { SpecialAdCard } from "@/components/explore/SpecialAdCard";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";

export const metadata: Metadata = {
  title: "Explore & Compare — Kuwana",
  description:
    "Compare telecom, banking, insurance, and education providers in Zimbabwe with transparent, explainable decision scores.",
};

export default function ExploreHubPage() {
  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Explore</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Tell us what you need, or pick a sector below.</p>

      <NeedIntake />

      <SpecialAdCard />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.values(SECTORS).map((sector) => {
          const Icon = sector.icon;
          const live = LIVE_SECTORS.includes(sector.slug);
          const card = (
            <>
              <Icon size={30} className={live ? "text-accent-teal" : "text-text-muted"} />
              <span className={clsx("font-medium text-[14px]", !live && "text-text-muted")}>
                {sector.name}
              </span>
              {live ? (
                <span className="text-[11px] text-text-muted">{sector.blurb}</span>
              ) : (
                <span className="rounded-full border border-border bg-bg-base px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Coming soon
                </span>
              )}
            </>
          );
          return live ? (
            <Link
              key={sector.slug}
              href={`/explore/${sector.slug}`}
              className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 text-center hover:border-accent-sky/50"
            >
              {card}
            </Link>
          ) : (
            <div
              key={sector.slug}
              aria-disabled="true"
              className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 text-center opacity-55"
            >
              {card}
            </div>
          );
        })}
      </div>

      <BottomTabBar />
    </div>
  );
}
