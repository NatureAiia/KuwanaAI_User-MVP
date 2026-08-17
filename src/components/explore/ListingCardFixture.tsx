import { ListingCard } from "@/components/ListingCard";
import type { ListingDTO } from "@/types/catalog";

// Mock content boneyard's CLI renders in place of real listings when
// capturing the `explore-listings` skeleton — see `fixture` in
// ExploreClient.tsx. Never rendered in the real app; only exists so the
// bone-capture browser has something pixel-accurate to measure while the
// grid's real data is still loading.
function fakeListing(id: string): ListingDTO {
  return {
    id,
    name: "Sample Listing Name",
    description: null,
    price: 25,
    currency: "USD",
    attributes: {},
    freshnessStatus: "fresh",
    lastVerifiedAt: new Date(0).toISOString(),
    sourceUrl: null,
    images: [],
    rating: null,
    reviewCount: 0,
    provider: { id: "fixture-provider", name: "Sample Provider", logoUrl: null, verified: true, websiteUrl: null },
  };
}

export function ListingCardFixture() {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <ListingCard
          key={i}
          listing={fakeListing(`fixture-${i}`)}
          score={72}
          trend={null}
          sectorSlug="fixture"
          selected={false}
          onToggleSelect={() => {}}
        />
      ))}
    </div>
  );
}
