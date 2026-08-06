/**
 * src/lib/catalog.ts
 * Single published-filtering gateway for all consumer-facing reads
 * Principle: Every consumer query MUST filter Listing.status = 'published'
 */
import { prisma } from './prisma'
import { ListingStatus, Prisma } from '@prisma/client'

const PUBLISHED: Prisma.ListingWhereInput = { status: ListingStatus.PUBLISHED }

type ListOptions = {
  sectorSlug?: string
  categorySlug?: string
  providerSlug?: string
  search?: string
  take?: number
  skip?: number
}

export async function getPublishedListings(opts: ListOptions = {}) {
  const where: Prisma.ListingWhereInput = { ...PUBLISHED }

  if (opts.sectorSlug) {
    where.sector = { slug: opts.sectorSlug }
  }
  if (opts.categorySlug) {
    where.category = { slug: opts.categorySlug }
  }
  if (opts.providerSlug) {
    where.provider = { slug: opts.providerSlug }
  }
  if (opts.search) {
    where.OR = [
      { title: { contains: opts.search, mode: 'insensitive' } },
      { description: { contains: opts.search, mode: 'insensitive' } },
    ]
  }

  return prisma.listing.findMany({
    where,
    include: {
      provider: true,
      category: { include: { sector: true } },
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 1 },
    },
    take: opts.take ?? 50,
    skip: opts.skip ?? 0,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getListingById(id: string) {
  return prisma.listing.findFirst({
    where: { id, ...PUBLISHED },
    include: {
      provider: true,
      category: { include: { attributeSchemas: { orderBy: { order: 'asc' } }, sector: true } },
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 90 },
    },
  })
}

export async function getSectorsWithCategories() {
  return prisma.sectorConfig.findMany({
    where: { status: { in: ['ACTIVE', 'COMING_SOON'] } },
    include: {
      categories: {
        include: { attributeSchemas: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })
}

export async function getAttributeSchemaForCategory(categoryId: string) {
  return prisma.attributeSchemaField.findMany({
    where: { categoryId },
    orderBy: { order: 'asc' },
  })
}

// Comparison scoring stub - actual scoring in src/lib/scoring.ts
export async function scoreListingsForUser(userId: string, listingIds: string[]) {
  const footprint = await prisma.sectorFootprint.findMany({ where: { userId } })
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, ...PUBLISHED },
    include: { category: true, provider: true },
  })
  // scoring delegated to app-layer zod-validated logic
  return { footprint, listings }
}

// Price history with FX override - never delete fallback
export async function getLatestFxRate(base: string, target: string) {
  const latest = await prisma.fxRate.findFirst({
    where: { baseCurrency: base, targetCurrency: target },
    orderBy: { effectiveAt: 'desc' },
  })
  return latest?.rate ?? null // fallback table in app layer
}

// Social intelligence feed
export async function getSocialMentionsForProvider(providerName: string, limit = 20) {
  return prisma.socialPriceMention.findMany({
    where: { matchedProvider: providerName },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

// Admin-only write path - enforced via requireAdmin() checking ADMIN_EMAILS allowlist
export const AdminWrite = {
  async publishListing(id: string) {
    // Zod in route should enforce draft/pending_review -> published only via admin
    return prisma.listing.update({ where: { id }, data: { status: 'PUBLISHED' } })
  },
  async rejectListing(id: string) {
    return prisma.listing.update({ where: { id }, data: { status: 'REJECTED' } })
  },
}
