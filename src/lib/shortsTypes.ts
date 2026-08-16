// Pure types shared between the server-only feed builder (lib/shorts.ts,
// which imports prisma) and the client-side feed component. Kept in a
// separate module with no server-only imports (no `prisma`, no `pg`) —
// ShortsFeed.tsx is a "use client" component, and importing anything from a
// module that pulls in `prisma`/`pg` drags Node-only built-ins (like `dns`)
// into the browser bundle and breaks the build.

import type { PriceTrend } from "@/lib/priceTrend";
import type { ListingDTO } from "@/types/catalog";

export type ListingShortsCard = {
  kind: "listing";
  id: string;
  name: string;
  image: string;
  providerLogoUrl: string | null;
  price: string;
  currency: string;
  providerName: string;
  sectorSlug: string;
  categorySlug: string;
  freshnessStatus: ListingDTO["freshnessStatus"];
  priceTrend: PriceTrend | null;
};

export type AdvertShortsCard = {
  kind: "advert";
  id: string;
  sponsorName: string;
  tagline: string;
  image: string;
};

export type ShortsCard = ListingShortsCard | AdvertShortsCard;
