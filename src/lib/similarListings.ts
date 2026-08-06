import { normalize } from "@/lib/scoring";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

// Below this, too few/weak shared attributes for the match to mean anything —
// exclude rather than surface noise.
const SIMILARITY_FLOOR = 40;

export type ClosestMatch = { listing: ListingDTO; similarity: number };

/**
 * Ranks candidates by how close their comparable attributes are to `target`'s,
 * within one category, across providers — the substitute-finder for listings
 * that don't share a barcode or a branded name (Econet's "PowerBundle 5GB" vs
 * NetOne's "OneFusion Monthly 15GB") but serve the same real need. Numeric
 * attributes score by scaled distance (reusing scoring.ts's normalize()),
 * boolean/enum/string attributes by exact match. A pair with zero comparable
 * attributes in common is excluded rather than scored 0 — that's "no signal",
 * not "not similar".
 */
export function findClosestMatches(
  target: ListingDTO,
  candidates: ListingDTO[],
  attributeSchema: AttributeSchemaFieldDTO[],
  limit = 3,
): ClosestMatch[] {
  const pool = candidates.filter((c) => c.id !== target.id && c.provider.id !== target.provider.id);
  if (pool.length === 0) return [];

  const comparableAttrs = attributeSchema.filter((a) => a.isComparable);
  const numericAttrs = comparableAttrs.filter((a) => a.dataType === "number");

  // One shared min/max per numeric attribute, computed once across target +
  // pool, so every candidate's distance is scaled consistently.
  const ranges = new Map<string, { min: number; max: number }>();
  for (const attr of numericAttrs) {
    const values = [target, ...pool]
      .map((l) => Number(l.attributes[attr.key]))
      .filter((v) => !Number.isNaN(v));
    if (values.length < 2) continue;
    ranges.set(attr.key, { min: Math.min(...values), max: Math.max(...values) });
  }

  const matches: ClosestMatch[] = [];
  for (const candidate of pool) {
    let scoreSum = 0;
    let attrCount = 0;

    for (const attr of comparableAttrs) {
      const targetValue = target.attributes[attr.key];
      const candidateValue = candidate.attributes[attr.key];
      if (targetValue === undefined || targetValue === null) continue;
      if (candidateValue === undefined || candidateValue === null) continue;

      if (attr.dataType === "number") {
        const range = ranges.get(attr.key);
        const t = Number(targetValue);
        const c = Number(candidateValue);
        if (!range || Number.isNaN(t) || Number.isNaN(c)) continue;
        scoreSum += normalize(Math.abs(t - c), 0, range.max - range.min, true);
      } else {
        scoreSum += targetValue === candidateValue ? 100 : 0;
      }
      attrCount += 1;
    }

    if (attrCount === 0) continue;
    const similarity = Math.round(scoreSum / attrCount);
    if (similarity >= SIMILARITY_FLOOR) matches.push({ listing: candidate, similarity });
  }

  return matches.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}
