import { prisma } from "@/lib/prisma";
import { computePriceTrend, type PriceTrend } from "@/lib/priceTrend";
import { deflate, getDriverReadings, DEFAULT_FX_DRIVER_NAME, DEFAULT_REGION } from "@/lib/realPriceIndex";

export type MarketBasketSummary = { basketName: string; componentCount: number };

/** Every basket an admin has curated, with how many components each has — the picker on /regulator/price-index. */
export async function getMarketBaskets(): Promise<MarketBasketSummary[]> {
  const rows = await prisma.marketBasketItem.groupBy({ by: ["basketName"], _count: { _all: true } });
  return rows
    .map((row) => ({ basketName: row.basketName, componentCount: row._count._all }))
    .sort((a, b) => a.basketName.localeCompare(b.basketName));
}

type WeightedPoint = { price: number; recordedAt: Date };

/**
 * Merges each component's own price history into a single weighted
 * composite series: at every distinct recordedAt timestamp across all
 * components, each component contributes its own most-recently-known price
 * (forward-filled) times its weight. The composite series only starts once
 * every component has at least one recorded price — a partial sum before
 * that point would understate the basket, not just be imprecise.
 */
export function buildCompositeSeries(
  componentHistories: { weight: number; history: { price: number; recordedAt: Date }[] }[],
): WeightedPoint[] {
  const allDates = [...new Set(componentHistories.flatMap((c) => c.history.map((h) => h.recordedAt.getTime())))].sort(
    (a, b) => a - b,
  );

  const points: WeightedPoint[] = [];
  for (const dateMs of allDates) {
    const date = new Date(dateMs);
    let total = 0;
    let everyComponentReady = true;

    for (const component of componentHistories) {
      const knownSoFar = component.history.filter((h) => h.recordedAt.getTime() <= dateMs);
      if (knownSoFar.length === 0) {
        everyComponentReady = false;
        break;
      }
      total += component.weight * knownSoFar[knownSoFar.length - 1].price;
    }

    if (everyComponentReady) points.push({ price: total, recordedAt: date });
  }

  return points;
}

export type BasketIndexTrend = {
  basketName: string;
  components: { label: string; listingName: string }[];
  nominal: PriceTrend | null;
  /** null when there's no EconomicDriver coverage for the composite series' window yet. */
  real: PriceTrend | null;
};

/**
 * A named basket's composite cost index, nominal and FX/CPI-deflated — the
 * "cost of living" reading a regulator actually wants (e.g. "the basic food
 * basket is up 4% in real terms this quarter"), built entirely from existing
 * ListingPriceHistory rows for its curated components rather than a
 * separately stored index table.
 */
export async function getBasketIndexTrend(
  basketName: string,
  driverName = DEFAULT_FX_DRIVER_NAME,
  region = DEFAULT_REGION,
): Promise<BasketIndexTrend | null> {
  const items = await prisma.marketBasketItem.findMany({
    where: { basketName },
    include: { listing: { select: { name: true, priceHistory: { orderBy: { recordedAt: "asc" } } } } },
  });
  if (items.length === 0) return null;

  const componentHistories = items.map((item) => ({
    weight: Number(item.weight),
    history: item.listing.priceHistory.map((h) => ({ price: Number(h.price), recordedAt: h.recordedAt })),
  }));

  const composite = buildCompositeSeries(componentHistories);
  const nominal = computePriceTrend(composite);

  const readings = await getDriverReadings(driverName, region);
  const deflatedComposite = deflate(composite, readings);
  const real = deflatedComposite.length >= 2 ? computePriceTrend(deflatedComposite) : null;

  return {
    basketName,
    components: items.map((item) => ({ label: item.label, listingName: item.listing.name })),
    nominal,
    real,
  };
}
