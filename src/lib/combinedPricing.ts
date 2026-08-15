import { getSectorPricingSummary, type PricingIntelligenceReport, type PricingOutlier } from "@/lib/pricingIntelligence";
import { getActiveDiscountsMap, computeEffectivePrice } from "@/lib/discounts";
import { getLatestEconomicDrivers, type EconomicDriverSummary } from "@/lib/economicDrivers";

export type CombinedPricingOutlier = PricingOutlier & {
  discountPercentOff: number | null;
  effectivePrice: number | null;
};

export type CombinedPricingView = {
  bySector: PricingIntelligenceReport["bySector"];
  outliers: CombinedPricingOutlier[];
  economicDrivers: EconomicDriverSummary[];
};

/**
 * A presentation-only merge of the existing outlier report with active
 * discounts and the latest economic indicators — no new statistics. The
 * z-score/outlier flags below are exactly what getSectorPricingSummary
 * already computed off base price; a discount only adds an `effectivePrice`
 * alongside it.
 */
export async function getCombinedPricingView(sectorSlug?: string): Promise<CombinedPricingView> {
  const [{ bySector, outliers }, economicDrivers] = await Promise.all([
    getSectorPricingSummary(sectorSlug),
    getLatestEconomicDrivers(),
  ]);

  const discountMap = await getActiveDiscountsMap(
    outliers.map((o) => ({ id: o.listingId, categoryId: o.categoryId })),
  );

  const annotatedOutliers: CombinedPricingOutlier[] = outliers.map((o) => {
    const discount = discountMap.get(o.listingId);
    const discountPercentOff = discount ? Number(discount.percentOff) : null;
    return {
      ...o,
      discountPercentOff,
      effectivePrice: discountPercentOff !== null ? computeEffectivePrice(o.price, discountPercentOff) : null,
    };
  });

  return { bySector, outliers: annotatedOutliers, economicDrivers };
}
