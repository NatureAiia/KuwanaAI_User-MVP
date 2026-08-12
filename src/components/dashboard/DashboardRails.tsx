import { getTopListings, getPersonalizedSpecials } from "@/lib/catalog";
import { HeroCarousel } from "@/components/dashboard/HeroCarousel";

/**
 * The dashboard's listing rails, split out so they can stream in behind a
 * Suspense boundary.
 *
 * getPersonalizedSpecials is by far the slowest thing the dashboard does —
 * it reads the user's comparisons, saved listings, and footprints, then
 * scores up to three categories. Awaiting it alongside the profile/XP reads
 * meant the greeting, the gamification strip, and the sector grid all waited
 * on it too, even though none of them depend on it. Now the shell paints
 * immediately and the rails arrive when they're ready.
 */
export async function DashboardRails({ userId }: { userId: string }) {
  const specials = await getPersonalizedSpecials(userId, 4);

  if (specials.length > 0) {
    return (
      <>
        {specials.map((s) => (
          <HeroCarousel
            key={s.categorySlug}
            title={`Specials for you: ${s.categoryName}`}
            sectorSlug={s.sectorSlug}
            listings={s.listings}
          />
        ))}
      </>
    );
  }

  // Fallback for a user with no engagement yet. Fetched only on this branch
  // — the previous version always ran both queries even when the
  // personalized rails were the ones actually rendered.
  const [telecomHero, bankingHero] = await Promise.all([
    getTopListings("telecom", "data-bundles", 4),
    getTopListings("banking", "savings-accounts", 4),
  ]);

  return (
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
  );
}

/** Placeholder sized to two rails, so streaming them in doesn't shift the page. */
export function DashboardRailsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-56 animate-pulse rounded bg-bg-surface" />
          <div className="h-[168px] w-full animate-pulse rounded-[var(--radius-card)] border border-border bg-bg-surface" />
        </div>
      ))}
    </div>
  );
}
