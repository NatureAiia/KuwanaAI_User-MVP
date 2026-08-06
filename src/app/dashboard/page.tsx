import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTopListings, getPersonalizedSpecials, getRecentlyViewed } from "@/lib/catalog";
import { SECTORS, LIVE_SECTORS } from "@/lib/sectors";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { DailyVisitPing } from "@/components/DailyVisitPing";
import { HeroCarousel } from "@/components/dashboard/HeroCarousel";
import { RecentlyViewedRow } from "@/components/dashboard/RecentlyViewedRow";
import { GamificationStrip } from "@/components/dashboard/GamificationStrip";
import { NeedIntake } from "@/components/explore/NeedIntake";

const ROLE_DASHBOARD: Partial<Record<string, string>> = {
  corporate: "/corporate",
  regulator: "/regulator",
  provider: "/provider",
};

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const roleRedirect = dbUser && ROLE_DASHBOARD[dbUser.role];
  if (roleRedirect) redirect(roleRedirect);

  const [profile, xp, streak, activeQuest, telecomHero, bankingHero, specials, recentlyViewed] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.userXp.findUnique({ where: { userId: user.id } }),
    prisma.userStreak.findUnique({ where: { userId: user.id } }),
    prisma.quest.findFirst({
      where: { activeTo: { gte: new Date() } },
      orderBy: { activeTo: "asc" },
    }),
    getTopListings("telecom", "data-bundles", 4),
    getTopListings("banking", "savings-accounts", 4),
    getPersonalizedSpecials(user.id, 4),
    getRecentlyViewed(user.id),
  ]);

  const firstName = profile?.fullName?.split(" ")[0];

  return (
    <div className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <DailyVisitPing />
      <Header />

      <div className="mt-4 flex items-center justify-between">
        <div>
          <p className="text-[13px] text-text-secondary">Welcome back{firstName ? "," : ""}</p>
          <h1 className="font-display text-[24px] font-bold">{firstName ?? "there"}</h1>
        </div>
      </div>

      <NeedIntake enableImageSearch />

      <div className="mt-4">
        <GamificationStrip
          totalXp={xp?.totalXp ?? 0}
          level={xp?.level ?? 1}
          currentStreak={streak?.currentStreak ?? 0}
          activeQuestName={activeQuest?.name ?? null}
        />
      </div>

      <div className="mt-6 space-y-6">
        <RecentlyViewedRow items={recentlyViewed} />
        {specials.length > 0 ? (
          specials.map((s) => (
            <HeroCarousel
              key={s.categorySlug}
              title={`Specials for you: ${s.categoryName}`}
              sectorSlug={s.sectorSlug}
              listings={s.listings}
            />
          ))
        ) : (
          <>
            <HeroCarousel
              title="Best value data bundles this week"
              sectorSlug="telecom"
              listings={telecomHero.listings}
            />
            <HeroCarousel
              title="Savings accounts with the lowest fees"
              sectorSlug="banking"
              listings={bankingHero.listings}
            />
          </>
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-[18px] font-semibold">Explore by sector</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          {Object.values(SECTORS).map((sector) => {
            const Icon = sector.icon;
            const live = LIVE_SECTORS.includes(sector.slug);
            return (
              <Link
                key={sector.slug}
                href={live ? `/explore/${sector.slug}` : "/explore/healthcare"}
                className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-border bg-bg-surface p-4 text-center hover:border-accent-sky/50"
              >
                <Icon size={26} className="text-accent-teal" />
                <span className="font-medium text-[13px]">{sector.name}</span>
                <span className="text-[11px] text-text-muted">
                  {live ? sector.blurb : "Coming soon"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <BottomTabBar />
    </div>
  );
}
