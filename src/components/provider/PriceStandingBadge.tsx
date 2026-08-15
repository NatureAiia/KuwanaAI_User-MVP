import { Badge } from "@/components/ui/Card";

// Deliberately friendlier framing than corporate's raw z-score/outlier
// language (see /corporate/investigations) — a sole trader wants "you're
// priced high" in plain language, not a statistical term. The same
// isOutlier/zScore signal from getProviderFeeComparison still drives it,
// just relabeled for this audience.
export type PriceStanding = "below" | "typical" | "above" | "unknown";

export function priceStanding(price: number, peerMedian: number, sampleSize: number): PriceStanding {
  if (sampleSize < 5 || peerMedian === 0) return "unknown";
  if (price < peerMedian * 0.9) return "below";
  if (price > peerMedian * 1.1) return "above";
  return "typical";
}

const STANDING_LABEL: Record<PriceStanding, string> = {
  below: "Below typical",
  typical: "Typical price",
  above: "Above typical",
  unknown: "Not enough data yet",
};

const STANDING_TONE: Record<PriceStanding, "teal" | "sky" | "coral" | "neutral"> = {
  below: "teal",
  typical: "sky",
  above: "coral",
  unknown: "neutral",
};

export function PriceStandingBadge({ standing }: { standing: PriceStanding }) {
  return <Badge tone={STANDING_TONE[standing]}>{STANDING_LABEL[standing]}</Badge>;
}
