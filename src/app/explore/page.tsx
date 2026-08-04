import Link from "next/link";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { NeedIntake } from "@/components/explore/NeedIntake";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";

export default function ExploreHubPage() {
  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Explore</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Tell us what you need, or pick a sector below.</p>

      <NeedIntake />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.values(SECTORS).map((sector) => {
          const Icon = sector.icon;
          const live = LIVE_SECTORS.includes(sector.slug);
          return (
            <Link
              key={sector.slug}
              href={live ? `/explore/${sector.slug}` : "/explore/healthcare"}
              className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-5 text-center hover:border-accent-sky/50"
            >
              <Icon size={30} className="text-accent-teal" />
              <span className="font-medium text-[14px]">{sector.name}</span>
              <span className="text-[11px] text-text-muted">{live ? sector.blurb : "Coming soon"}</span>
            </Link>
          );
        })}
      </div>

      <BottomTabBar />
    </div>
  );
}
