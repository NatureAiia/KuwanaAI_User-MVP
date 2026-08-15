import { prisma } from "@/lib/prisma";
import { computePriceTrend, type PriceTrend } from "@/lib/priceTrend";

// Matches the placeholder convention already shown in EconomicDriverForm
// ("e.g. USD_ZIG_RATE, inflation_rate") — this only works once an admin is
// actually entering period readings under this exact name; there's no
// ingestion pipeline behind it yet.
export const DEFAULT_FX_DRIVER_NAME = "USD_ZIG_RATE";
export const DEFAULT_REGION = "ZW";

export type DriverReading = { value: number; period: Date };

/** Shared by getRealPriceMovers and getBasketIndexTrend — one place that knows how to read an EconomicDriver's series. */
export async function getDriverReadings(
  driverName = DEFAULT_FX_DRIVER_NAME,
  region = DEFAULT_REGION,
): Promise<DriverReading[]> {
  const rows = await prisma.economicDriver.findMany({ where: { name: driverName, region }, orderBy: { period: "asc" } });
  return rows.map((row) => ({ value: Number(row.value), period: row.period }));
}

/** The most recent driver reading at or before `at`, falling back to the earliest reading if `at` predates all of them. */
export function nearestPriorReading(readings: DriverReading[], at: Date): DriverReading | null {
  let candidate: DriverReading | null = null;
  for (const reading of readings) {
    if (reading.period.getTime() <= at.getTime()) candidate = reading;
    else break;
  }
  return candidate ?? readings[0] ?? null;
}

/**
 * Rewrites a nominal price history into its FX/CPI-deflated equivalent — each
 * point divided by the driver reading nearest-prior to when it was recorded.
 * The scale of the divisor doesn't matter (it cancels out in
 * computePriceTrend's % change), only that it's consistent per point, so this
 * is a straight "how many units of the driver did this cost" series.
 */
export function deflate(
  points: { price: number; recordedAt: Date }[],
  readings: DriverReading[],
): { price: number; recordedAt: Date }[] {
  if (readings.length === 0) return [];
  return points.flatMap((point) => {
    const reading = nearestPriorReading(readings, point.recordedAt);
    if (!reading || reading.value === 0) return [];
    return [{ price: point.price / reading.value, recordedAt: point.recordedAt }];
  });
}

export type RealPriceMover = {
  listingId: string;
  listingName: string;
  providerName: string;
  sectorSlug: string;
  sectorName: string;
  categoryName: string;
  nominal: PriceTrend;
  /** null when there's no EconomicDriver coverage for this listing's history window yet. */
  real: PriceTrend | null;
};

/**
 * Sector-wide "real vs. nominal" price movement — deflates each published
 * listing's ListingPriceHistory by the matching-period EconomicDriver
 * reading before computing its trend, so a nominal price hike driven purely
 * by currency depreciation/inflation doesn't read the same as a genuine
 * real-terms price increase. This is the core of Zimbabwe-context
 * price-gouging detection: nominal moves are noise, real moves are signal.
 *
 * Requires ongoing EconomicDriver entries under `driverName`/`region`
 * (admin-entered at /admin/economic-drivers) — a listing with no driver
 * coverage over its price history window comes back with `real: null`
 * rather than a fabricated number.
 */
export async function getRealPriceMovers(
  sectorSlug?: string,
  driverName = DEFAULT_FX_DRIVER_NAME,
  region = DEFAULT_REGION,
): Promise<RealPriceMover[]> {
  const [listings, readings] = await Promise.all([
    prisma.listing.findMany({
      where: {
        status: "published",
        category: { sector: { status: "live", ...(sectorSlug ? { slug: sectorSlug } : {}) } },
      },
      include: {
        provider: { select: { name: true } },
        category: { include: { sector: true } },
        priceHistory: { orderBy: { recordedAt: "asc" } },
      },
    }),
    getDriverReadings(driverName, region),
  ]);

  const movers: RealPriceMover[] = [];
  for (const listing of listings) {
    const points = listing.priceHistory.map((row) => ({ price: Number(row.price), recordedAt: row.recordedAt }));
    const nominal = computePriceTrend(points);
    if (!nominal) continue;

    const deflatedPoints = deflate(points, readings);
    const real = deflatedPoints.length >= 2 ? computePriceTrend(deflatedPoints) : null;

    movers.push({
      listingId: listing.id,
      listingName: listing.name,
      providerName: listing.provider.name,
      sectorSlug: listing.category.sector.slug,
      sectorName: listing.category.sector.name,
      categoryName: listing.category.name,
      nominal,
      real,
    });
  }

  // Biggest genuine real-terms movers first — listings with no driver
  // coverage (real: null) sort after every listing that has one, rather than
  // being treated as "no movement".
  movers.sort((a, b) => Math.abs(b.real?.changePercent ?? -1) - Math.abs(a.real?.changePercent ?? -1));
  return movers;
}
