/**
 * src/lib/scoring.ts
 * Example scoring logic - zod-validated against AttributeSchemaField
 * Keeps DB loose (JSON), app strict (zod)
 */
import { z } from 'zod'

// Example: telecom scoring based on footprint
const TelecomFootprint = z.object({
  monthly_budget_usd: z.number().min(0),
  data_need_gb: z.number().min(0),
  network_preference: z.enum(['Econet','NetOne','Telecel','Any']).optional(),
})

export function scoreListing(footprint: unknown, listingAttributes: Record<string, any>) {
  const parsed = TelecomFootprint.safeParse(footprint)
  if (!parsed.success) return { score: 0, reason: 'footprint invalid' }

  const { monthly_budget_usd, data_need_gb } = parsed.data
  const price = listingAttributes.price_usd ?? listingAttributes.monthly_usd ?? 999
  const gb = listingAttributes.data_gb ?? 0

  let score = 100
  if (price > monthly_budget_usd) score -= 30
  if (gb < data_need_gb) score -= 40
  if (price <= monthly_budget_usd && gb >= data_need_gb) score += 10

  return { score: Math.max(0, Math.min(100, score)), breakdown: { price, gb, budget: monthly_budget_usd, need: data_need_gb } }
}
