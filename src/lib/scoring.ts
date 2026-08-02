import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

function normalize(value: number, min: number, max: number, invert: boolean) {
  if (max === min) return 100;
  const t = (value - min) / (max - min);
  return Math.round((invert ? 1 - t : t) * 100);
}

/**
 * Derives a 0–100 "value score" per listing from real seeded attributes —
 * price (lower is better) blended with the first comparable numeric
 * "benefit" attribute (higher is better), when the category has one.
 * This is a simple, transparent heuristic, not an invented statistic: it
 * only ever combines fields already on the listing record (Section 9).
 */
export function computeValueScores(
  listings: ListingDTO[],
  attributeSchema: AttributeSchemaFieldDTO[],
): Record<string, number> {
  if (listings.length === 0) return {};

  const prices = listings.map((l) => l.price);
  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);

  const benefitField = attributeSchema.find(
    (a) => a.dataType === "number" && a.isComparable && a.key !== "price",
  );

  const scores: Record<string, number> = {};
  for (const listing of listings) {
    const priceScore = normalize(listing.price, priceMin, priceMax, true);

    if (!benefitField) {
      scores[listing.id] = priceScore;
      continue;
    }

    const benefitValues = listings
      .map((l) => Number(l.attributes[benefitField.key]))
      .filter((v) => !Number.isNaN(v));
    const benefitMin = Math.min(...benefitValues);
    const benefitMax = Math.max(...benefitValues);
    const benefitValue = Number(listing.attributes[benefitField.key]);
    const benefitScore = Number.isNaN(benefitValue)
      ? priceScore
      : normalize(benefitValue, benefitMin, benefitMax, false);

    scores[listing.id] = Math.round(priceScore * 0.5 + benefitScore * 0.5);
  }
  return scores;
}
