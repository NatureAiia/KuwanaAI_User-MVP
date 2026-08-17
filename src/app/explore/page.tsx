import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { clsx } from "clsx";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { NeedIntake } from "@/components/explore/NeedIntake";
import { AdvertRotator } from "@/components/explore/AdvertRotator";
import { prisma } from "@/lib/prisma";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";

export const metadata: Metadata = {
  title: "Explore & Compare — Kuwana",
  description:
    "Compare telecom, banking, insurance, and education providers in Zimbabwe with transparent, explainable decision scores.",
};

/**
 * The one part of this page that needs a database.
 *
 * `await connection()` marks it as request-time work, which stops the build
 * from trying to prerender it. Without that, `next build` ran this query with
 * no database reachable and failed the whole build:
 *
 *   Error occurred prerendering page "/explore"
 *   Can't reach database server at 127.0.0.1:5432
 *
 * That is not only a local inconvenience — the Dockerfile builds with the same
 * placeholder DATABASE_URL, so the production image could not be built at all.
 * It went unnoticed because CI's verify job fails before the build job runs.
 *
 * Splitting it out this way keeps the rest of the page — header, intake,
 * sector grid, all of it static — prerenderable, and streams the adverts in
 * behind a Suspense boundary instead of making the entire route dynamic.
 */
async function SponsorAdverts() {
  await connection();
  const adverts = await prisma.advert.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, sponsorName: true, tagline: true, imageUrl: true },
  });
  return <AdvertRotator adverts={adverts} />;
}

export default async function ExploreHubPage() {
  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <Header />
      <h1 className="mt-4 font-display text-[24px] font-bold">Explore</h1>
      <p className="mt-1 text-[13px] text-text-secondary">Tell us what you need, or pick a sector below.</p>

      <NeedIntake />

      {/* No fallback: AdvertRotator renders nothing when there are no
          adverts, so a placeholder here would reserve space the loaded state
          may not use and shift the sector grid underneath it. */}
      <Suspense fallback={null}>
        <SponsorAdverts />
      </Suspense>

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
