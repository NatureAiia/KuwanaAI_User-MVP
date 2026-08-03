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

export type PriceForecast = {
  projectedPrice: number;
  projectionDays: number;
};

/**
 * Projects the price forward by fitting a least-squares line through the
 * recorded history and extrapolating — a plain linear projection of what
 * already happened, not a predictive model. Returns null when there aren't
 * enough points to fit a line, or the line is flat (no meaningful slope).
 */
export function computePriceForecast(trend: PriceTrend, projectionDays = 14): PriceForecast | null {
  if (trend.points.length < 3) return null;

  const firstMs = new Date(trend.points[0].recordedAt).getTime();
  const xs = trend.points.map((p) => (new Date(p.recordedAt).getTime() - firstMs) / 86_400_000);
  const ys = trend.points.map((p) => p.price);
  const n = xs.length;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const projectedX = xs[xs.length - 1] + projectionDays;
  const projectedPrice = Math.max(0, intercept + slope * projectedX);

  if (Math.abs(projectedPrice - trend.currentPrice) < trend.currentPrice * 0.01) return null;

  return { projectedPrice: Math.round(projectedPrice * 100) / 100, projectionDays };
}
