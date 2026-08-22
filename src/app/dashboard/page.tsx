import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTopListings, getPersonalizedSpecials, getRecentlyViewed, getFavoriteProductSpecials } from "@/lib/catalog";
import { BottomTabBar } from "@/components/BottomTabBar";
import { Header } from "@/components/Header";
import { DailyVisitPing } from "@/components/DailyVisitPing";
import { HeroCarousel, type HeroCarouselListing } from "@/components/dashboard/HeroCarousel";
import { RecentlyViewedRow } from "@/components/dashboard/RecentlyViewedRow";
import { FeaturedCategories } from "@/components/dashboard/FeaturedCategories";
import { QuickAccessTabs } from "@/components/dashboard/QuickAccessTabs";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { NeedIntake } from "@/components/explore/NeedIntake";
import { WelcomeModal } from "@/components/WelcomeModal";
import { ProfileNudge } from "@/components/ProfileNudge";

const ROLE_DASHBOARD: Partial<Record<string, string>> = {
  corporate: "/corporate",
  regulator: "/regulator",
  provider: "/provider",
  admin: "/admin",
};

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const roleRedirect = dbUser && ROLE_DASHBOARD[dbUser.role];
  if (roleRedirect) redirect(roleRedirect);

  const [profile, streak, telecomHero, bankingHero, specials, favoriteSpecials, recentlyViewed] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId: user.id } }),
    prisma.userStreak.findUnique({ where: { userId: user.id } }),
    getTopListings("telecom", "data-bundles", 4),
    getTopListings("banking", "savings-accounts", 4),
    getPersonalizedSpecials(user.id, 4),
    getFavoriteProductSpecials(user.id, 4),
    getRecentlyViewed(user.id),
  ]);

  const firstName = profile?.fullName?.split(" ")[0];

  // One "Recommended for you" section, a mixture of all categories: the
  // category-grouped picks are flattened into a single score-ranked row and
  // each card keeps its own sector + a category chip. Source of truth:
  // notebooks/recommendation_engine.ipynb; the app computes the same picks
  // on-the-fly via getFavoriteProductSpecials so the two stay in sync.
  const recommended: HeroCarouselListing[] = favoriteSpecials
    .flatMap((s) =>
      s.listings.map((l) => ({
        ...l,
        sectorSlug: s.sectorSlug,
        categoryName: s.categoryName,
      })),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // One "Specials for you" section, likewise a cross-category mixture. When
  // personalization has nothing yet, fall back to the two evergreen
  // "best value" hero feeds mixed into the same single row.
  const specialsMixed: HeroCarouselListing[] = (specials.length > 0
    ? specials.flatMap((s) =>
        s.listings.map((l) => ({
          ...l,
          sectorSlug: s.sectorSlug,
          categoryName: s.categoryName,
        })),
      )
    : [
        ...telecomHero.listings.map((l) => ({ ...l, sectorSlug: "telecom", categoryName: telecomHero.categoryName })),
        ...bankingHero.listings.map((l) => ({ ...l, sectorSlug: "banking", categoryName: bankingHero.categoryName })),
      ]
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return (
    <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col px-5 pb-24 pt-6 md:px-10">
      <WelcomeModal userId={user.id} role="consumer" />
      <DailyVisitPing />
      {/* Streak badge lives in the header itself (to the left of the bell),
          so the dashboard passes the current streak through here. */}
      <Header currentStreak={streak?.currentStreak ?? 0} />

      <WelcomeBanner firstName={firstName ?? null} />

      <ProfileNudge
        userId={user.id}
        profile={{
          ageRange: profile?.ageRange ?? null,
          occupation: profile?.occupation ?? null,
          location: profile?.location ?? null,
        }}
      />

      <NeedIntake enableImageSearch />

      <div className="mt-8 space-y-8">
        {/* "Featured Categories" sits first, right under the search bar —
            circular sector shortcuts with breathing room, instead of the old
            rectangular grid at the bottom of the page. */}
        <FeaturedCategories />

        {recommended.length > 0 && (
          <HeroCarousel title="Recommended for you" listings={recommended} />
        )}

        {/* "Pick up where you left off" sits right under the recommendations,
            with a View all link to the full cross-category history page. */}
        <RecentlyViewedRow items={recentlyViewed} />

        {specialsMixed.length > 0 && (
          <HeroCarousel title="Specials for you" listings={specialsMixed} />
        )}

        {/* Under the specials: suggested quick-access tabs for the categories
            people most often jump straight to. */}
        <QuickAccessTabs />
      </div>

      <BottomTabBar />
    </div>
  );
}
