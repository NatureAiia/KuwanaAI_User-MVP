import { prisma } from './prisma'
import { createClient as createRedis } from 'redis'
import { MeiliSearch } from 'meilisearch'

// Tier 3 clients
export const redis = createRedis({ url: process.env.REDIS_URL || 'redis://localhost:6379' })
export const meili = new MeiliSearch({ host: process.env.MEILISEARCH_HOST || 'http://localhost:7700', apiKey: process.env.MEILISEARCH_KEY })

// Tier 1 is source of truth - reuse existing
export { getPublishedListings, getListingById, getSectorsWithCategories } from './catalog'

// Tier 2 - Analytics Warehouse
export const Tier2 = {
  async getDailyPriceTrend(listingId: string, days = 90) {
    return prisma.$queryRaw`
      SELECT date, avg_price, min_price, max_price 
      FROM analytics.listing_price_daily 
      WHERE listing_id = ${listingId}::uuid 
      ORDER BY date DESC LIMIT ${days}
    `
  },
  async getSectorIndex(sector: string, days = 30) {
    return prisma.$queryRaw`
      SELECT date, index_value, fx_adjusted 
      FROM analytics.sector_price_index 
      WHERE sector = ${sector}::\"Sector\" 
      ORDER BY date DESC LIMIT ${days}
    `
  },
  async getLeaderboard(period: 'daily' | 'weekly' | 'monthly' = 'weekly') {
    const cached = await redis.get(`leaderboard:${period}`)
    if (cached) return JSON.parse(cached)

    const snapshot = await prisma.leaderboardSnapshot.findFirst({
      where: { period },
      orderBy: { date: 'desc' },
    })
    if (snapshot) await redis.setEx(`leaderboard:${period}`, 60, JSON.stringify(snapshot.ranking))
    return snapshot?.ranking ?? []
  },
  async getUserActivityDaily(userId: string) {
    return prisma.userEventDaily.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 30 })
  }
}

// Tier 3 - Serving Layer
export const Tier3 = {
  async searchListings(query: string, filters: { sector?: string; maxPrice?: number } = {}) {
    const index = meili.index('listings')
    const result = await index.search(query, {
      filter: filters.sector ? `sector = ${filters.sector}` : undefined,
      limit: 20,
    })
    // Hydrate from Tier1 to enforce PUBLISHED gate
    const ids = result.hits.map((h: any) => h.id)
    if (!ids.length) return []
    return prisma.listing.findMany({
      where: { id: { in: ids }, status: 'PUBLISHED' },
      include: { provider: true, category: true },
    })
  },

  async vectorSearch(embedding: number[], limit = 5) {
    // pgvector cosine search in analytics.message_embeddings + public.listings
    return prisma.$queryRaw`
      SELECT id, title, 1 - (embedding <=> ${embedding}::vector) as similarity
      FROM public.listings
      WHERE status = 'PUBLISHED' AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embedding}::vector
      LIMIT ${limit}
    `
  },

  async getCachedListing(id: string) {
    const key = `listing:${id}`
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached)
    const listing = await prisma.listing.findFirst({ where: { id, status: 'PUBLISHED' }, include: { provider: true } })
    if (listing) await redis.setEx(key, 300, JSON.stringify(listing))
    return listing
  },

  async invalidateListing(id: string) {
    await redis.del(`listing:${id}`)
    await meili.index('listings').deleteDocument(id).catch(() => {})
  }
}

// Unified 3-tier gateway - consumer-facing reads go through here
export async function getListings3Tier(opts: { sectorSlug?: string; search?: string; take?: number } = {}) {
  if (opts.search) {
    return Tier3.searchListings(opts.search, { sector: opts.sectorSlug })
  }
  // No search -> check cache -> Tier1
  const cacheKey = `listings:${opts.sectorSlug || 'all'}:${opts.take || 50}`
  const cached = await redis.get(cacheKey).catch(() => null)
  if (cached) return JSON.parse(cached)

  const listings = await prisma.listing.findMany({
    where: { status: 'PUBLISHED', sector: opts.sectorSlug ? { slug: opts.sectorSlug } : undefined },
    include: { provider: true, category: true },
    take: opts.take ?? 50,
    orderBy: { updatedAt: 'desc' },
  })
  await redis.setEx(cacheKey, 300, JSON.stringify(listings)).catch(() => {})
  return listings
}
