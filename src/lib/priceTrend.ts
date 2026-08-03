export type PricePoint = { price: number; recordedAt: string };

export type PriceTrend = {
  currentPrice: number;
  earliestPrice: number;
  changePercent: number;
  direction: "down" | "up" | "flat";
  periodDays: number;
  points: PricePoint[];
};

const FLAT_THRESHOLD_PERCENT = 2;

/**
 * Derives a price trend from raw ListingPriceHistory rows — earliest vs
 * latest recorded price, with a `direction` classification. A transparent
 * aggregation, not a forecast: it describes what already happened, not what
 * will happen next.
 */
export function computePriceTrend(
  history: { price: number; recordedAt: Date }[],
): PriceTrend | null {
  if (history.length < 2) return null;

  const sorted = [...history].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const earliestPrice = Number(earliest.price);
  const currentPrice = Number(latest.price);

  const changePercent = earliestPrice === 0 ? 0 : ((currentPrice - earliestPrice) / earliestPrice) * 100;
  const periodDays = Math.round((latest.recordedAt.getTime() - earliest.recordedAt.getTime()) / 86_400_000);
  const direction =
    Math.abs(changePercent) < FLAT_THRESHOLD_PERCENT ? "flat" : changePercent < 0 ? "down" : "up";

  return {
    currentPrice,
    earliestPrice,
    changePercent: Math.round(changePercent * 10) / 10,
    direction,
    periodDays,
    points: sorted.map((p) => ({ price: Number(p.price), recordedAt: p.recordedAt.toISOString() })),
  };
}
