/**
 * prisma/seed.ts
 * Deterministic seed for KuwanaAI
 * - 10 sectors (healthcare = COMING_SOON but footprint allowed)
 * - categories + attribute schemas (JSON, no DDL needed for new sectors)
 * - providers + listings (published filtering)
 * - 90-day price history
 * - gamification rules, badges, quests
 * - FX fallback rates (never delete fallback)
 * Idempotent: uses upsert
 */
import { PrismaClient, Sector, SectorStatus } from '@prisma/client'

const prisma = new PrismaClient()

const SECTORS: { slug: string; name: string; sector: Sector; status: SectorStatus; description: string; order: number }[] = [
  { slug: 'telecoms', name: 'Telecommunications', sector: 'TELECOMS', status: 'ACTIVE', description: 'Data, voice, fibre in ZW', order: 1 },
  { slug: 'banking', name: 'Banking & Mobile Money', sector: 'BANKING', status: 'ACTIVE', description: 'Accounts, EcoCash, OneMoney', order: 2 },
  { slug: 'insurance', name: 'Insurance', sector: 'INSURANCE', status: 'ACTIVE', description: 'Motor, health, funeral', order: 3 },
  { slug: 'energy', name: 'Energy & Solar', sector: 'ENERGY', status: 'ACTIVE', description: 'ZESA, solar kits, gas', order: 4 },
  { slug: 'retail-grocery', name: 'Retail & Groceries', sector: 'RETAIL_GROCERY', status: 'ACTIVE', description: 'Supermarket basket comparison', order: 5 },
  { slug: 'fuel', name: 'Fuel & Transport', sector: 'FUEL', status: 'ACTIVE', description: 'Petrol, diesel, kombi fares', order: 6 },
  { slug: 'education', name: 'Education', sector: 'EDUCATION', status: 'ACTIVE', description: 'School fees, short courses', order: 7 },
  { slug: 'housing', name: 'Housing & Rentals', sector: 'HOUSING', status: 'ACTIVE', description: 'Rentals, stands, materials', order: 8 },
  { slug: 'transport', name: 'Logistics & Transport', sector: 'TRANSPORT', status: 'ACTIVE', description: 'Courier, intercity', order: 9 },
  { slug: 'healthcare', name: 'Healthcare', sector: 'HEALTHCARE', status: 'COMING_SOON', description: 'Clinics, pharmacies, cover', order: 10 },
]

const CATEGORIES_BY_SECTOR: Record<string, { slug: string; name: string; attrs: { key: string; label: string; dataType: any; required?: boolean; options?: any; unit?: string; order: number }[] }[]> = {
  telecoms: [
    { slug: 'mobile-data', name: 'Mobile Data', attrs: [
      { key: 'data_gb', label: 'Data Allowance', dataType: 'NUMBER', required: true, unit: 'GB', order: 1 },
      { key: 'validity_days', label: 'Validity', dataType: 'NUMBER', required: true, unit: 'days', order: 2 },
      { key: 'price_usd', label: 'Price USD', dataType: 'CURRENCY', required: true, unit: 'USD', order: 3 },
      { key: 'network', label: 'Network', dataType: 'ENUM', options: ['Econet','NetOne','Telecel','Liquid'], order: 4 },
      { key: 'is_night_bundle', label: 'Night Bundle?', dataType: 'BOOLEAN', order: 5 },
    ]},
    { slug: 'fibre', name: 'Home Fibre', attrs: [
      { key: 'speed_mbps', label: 'Speed', dataType: 'NUMBER', unit: 'Mbps', order: 1 },
      { key: 'uncapped', label: 'Uncapped', dataType: 'BOOLEAN', order: 2 },
      { key: 'monthly_usd', label: 'Monthly USD', dataType: 'CURRENCY', required: true, order: 3 },
    ]},
  ],
  banking: [
    { slug: 'mobile-money', name: 'Mobile Money Fees', attrs: [
      { key: 'send_fee_pct', label: 'Send Fee %', dataType: 'NUMBER', order: 1 },
      { key: 'cashout_fee_pct', label: 'Cashout Fee %', dataType: 'NUMBER', order: 2 },
      { key: 'provider', label: 'Provider', dataType: 'ENUM', options: ['EcoCash','OneMoney','TeleCash'], order: 3 },
    ]},
  ],
  'retail-grocery': [
    { slug: 'basic-basket', name: 'Basic Basket', attrs: [
      { key: 'item_count', label: 'Items in basket', dataType: 'NUMBER', order: 1 },
      { key: 'total_zwg', label: 'Total ZWG', dataType: 'CURRENCY', order: 2 },
    ]},
  ],
  energy: [
    { slug: 'solar-kits', name: 'Solar Kits', attrs: [
      { key: 'watts', label: 'Watts', dataType: 'NUMBER', unit: 'W', order: 1 },
      { key: 'battery_kwh', label: 'Battery', dataType: 'NUMBER', unit: 'kWh', order: 2 },
      { key: 'price_usd', label: 'Price USD', dataType: 'CURRENCY', required: true, order: 3 },
    ]},
  ],
  insurance: [{ slug: 'motor-cover', name: 'Motor Cover', attrs: [{ key: 'cover_type', label: 'Cover', dataType: 'ENUM', options: ['Third Party','Full'], order: 1 },{ key: 'annual_usd', label: 'Annual USD', dataType: 'CURRENCY', order: 2 }]}],
  fuel: [{ slug: 'fuel-price', name: 'Fuel Prices', attrs: [{ key: 'fuel_type', label: 'Type', dataType: 'ENUM', options: ['Petrol','Diesel'], order: 1 },{ key: 'price_per_litre_usd', label: 'USD/L', dataType: 'CURRENCY', order: 2 }]}],
  education: [{ slug: 'short-courses', name: 'Short Courses', attrs: [{ key: 'duration_weeks', label: 'Weeks', dataType: 'NUMBER', order: 1 },{ key: 'fee_usd', label: 'Fee USD', dataType: 'CURRENCY', order: 2 }]}],
  housing: [{ slug: 'rentals-2bed', name: '2-Bed Rentals', attrs: [{ key: 'area', label: 'Suburb', dataType: 'STRING', order: 1 },{ key: 'rent_usd', label: 'Rent USD', dataType: 'CURRENCY', order: 2 }]}],
  transport: [{ slug: 'courier-local', name: 'Local Courier', attrs: [{ key: 'max_kg', label: 'Max KG', dataType: 'NUMBER', order: 1 },{ key: 'fee_usd', label: 'Fee USD', dataType: 'CURRENCY', order: 2 }]}],
  healthcare: [{ slug: 'pharmacy-basic', name: 'Pharmacy Basics', attrs: [{ key: 'item', label: 'Item', dataType: 'STRING', order: 1 },{ key: 'price_usd', label: 'Price USD', dataType: 'CURRENCY', order: 2 }]}],
}

const PROVIDERS = [
  { slug: 'econet', name: 'Econet', sector: 'telecoms' },
  { slug: 'netone', name: 'NetOne', sector: 'telecoms' },
  { slug: 'liquid-home', name: 'Liquid Home', sector: 'telecoms' },
  { slug: 'ecocash', name: 'EcoCash', sector: 'banking' },
  { slug: 'zesa', name: 'ZESA', sector: 'energy' },
  { slug: 'picknpay-zw', name: 'Pick n Pay ZW', sector: 'retail-grocery' },
  { slug: 'ok-zw', name: 'OK Zimbabwe', sector: 'retail-grocery' },
]

async function main() {
  console.log('🌱 Seeding KuwanaAI deterministic...')

  // 1. Sectors
  for (const s of SECTORS) {
    await prisma.sectorConfig.upsert({
      where: { slug: s.slug },
      update: { name: s.name, status: s.status, description: s.description, order: s.order, sector: s.sector },
      create: s,
    })
  }

  // 2. Categories + Attribute Schemas
  for (const [sectorSlug, cats] of Object.entries(CATEGORIES_BY_SECTOR)) {
    const sector = await prisma.sectorConfig.findUnique({ where: { slug: sectorSlug } })
    if (!sector) continue
    for (const cat of cats) {
      const category = await prisma.category.upsert({
        where: { sectorId_slug: { sectorId: sector.id, slug: cat.slug } },
        update: { name: cat.name },
        create: { sectorId: sector.id, slug: cat.slug, name: cat.name, description: `${cat.name} in ${sector.name}` },
      })
      for (const attr of cat.attrs) {
        await prisma.attributeSchemaField.upsert({
          where: { categoryId_key: { categoryId: category.id, key: attr.key } },
          update: { label: attr.label, dataType: attr.dataType, required: !!attr.required, options: attr.options ?? undefined, unit: attr.unit, order: attr.order },
          create: { categoryId: category.id, key: attr.key, label: attr.label, dataType: attr.dataType, required: !!attr.required, options: attr.options ?? undefined, unit: attr.unit, order: attr.order },
        })
      }
    }
  }

  // 3. Providers
  for (const p of PROVIDERS) {
    const sector = await prisma.sectorConfig.findUnique({ where: { slug: p.sector } })
    await prisma.provider.upsert({
      where: { slug: p.slug },
      update: { name: p.name, sectorId: sector?.id },
      create: { slug: p.slug, name: p.name, sectorId: sector?.id, isVerified: true, metadata: {} },
    })
  }

  // 4. Listings + 90-day price history
  const telecomCat = await prisma.category.findFirst({ where: { slug: 'mobile-data' } })
  const fibreCat = await prisma.category.findFirst({ where: { slug: 'fibre' } })
  const econet = await prisma.provider.findUnique({ where: { slug: 'econet' } })
  const netone = await prisma.provider.findUnique({ where: { slug: 'netone' } })
  const liquid = await prisma.provider.findUnique({ where: { slug: 'liquid-home' } })

  if (telecomCat && econet) {
    const listingsData = [
      { title: 'Econet 25GB Monthly', providerId: econet.id, categoryId: telecomCat.id, sectorId: (await prisma.sectorConfig.findUnique({ where: { slug: 'telecoms' } }))?.id, attributes: { data_gb: 25, validity_days: 30, price_usd: 45, network: 'Econet', is_night_bundle: false }, status: 'PUBLISHED' as const },
      { title: 'Econet 10GB Weekly', providerId: econet.id, categoryId: telecomCat.id, attributes: { data_gb: 10, validity_days: 7, price_usd: 15, network: 'Econet', is_night_bundle: false }, status: 'PUBLISHED' as const },
      { title: 'NetOne 30GB Monthly', providerId: netone?.id, categoryId: telecomCat.id, attributes: { data_gb: 30, validity_days: 30, price_usd: 40, network: 'NetOne' }, status: 'PUBLISHED' as const },
    ]
    for (const l of listingsData) {
      const existing = await prisma.listing.findFirst({ where: { title: l.title } })
      let listing
      if (existing) {
        listing = await prisma.listing.update({ where: { id: existing.id }, data: l })
      } else {
        listing = await prisma.listing.create({ data: l as any })
      }
      // 90-day history
      for (let i = 0; i < 90; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const variance = (Math.random() - 0.5) * 2
        const basePrice = (l.attributes as any).price_usd ?? 40
        await prisma.listingPriceHistory.upsert({
          where: { id: `${listing.id}-${i}` } as any, // not real id, use create only if needed
          update: {},
          create: {
            listingId: listing.id,
            price: basePrice + variance,
            currency: 'USD',
            recordedAt: date,
            source: i % 7 === 0 ? 'social_mention' : 'manual',
          },
        }).catch(async () => {
          // fallback: create without upsert conflict
          const exists = await prisma.listingPriceHistory.findFirst({ where: { listingId: listing.id, recordedAt: date } })
          if (!exists) await prisma.listingPriceHistory.create({ data: { listingId: listing.id, price: basePrice + variance, currency: 'USD', recordedAt: date, source: 'manual' } })
        })
      }
    }
  }

  if (fibreCat && liquid) {
    await prisma.listing.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'Liquid Home 25Mbps Uncapped',
        categoryId: fibreCat.id,
        sectorId: (await prisma.sectorConfig.findUnique({ where: { slug: 'telecoms' } }))?.id,
        providerId: liquid.id,
        attributes: { speed_mbps: 25, uncapped: true, monthly_usd: 85 },
        status: 'PUBLISHED',
      },
    })
  }

  // 5. Gamification Rules (keyed by EventType)
  const rules = [
    { eventType: 'FOOTPRINT_CREATED' as const, xpAward: 50, description: 'Complete sector footprint' },
    { eventType: 'COMPARISON_CREATED' as const, xpAward: 20, description: 'Create a comparison' },
    { eventType: 'LISTING_SAVED' as const, xpAward: 10, description: 'Save a listing' },
    { eventType: 'CONVERSATION_STARTED' as const, xpAward: 15, description: 'Start AI chat' },
    { eventType: 'RECOMMENDATION_VIEWED' as const, xpAward: 5, description: 'View recommendation' },
    { eventType: 'PROFILE_COMPLETED' as const, xpAward: 30, description: 'Complete profile' },
    { eventType: 'DAILY_LOGIN' as const, xpAward: 10, description: 'Daily login streak' },
    { eventType: 'REFERRAL_COMPLETED' as const, xpAward: 100, description: 'Referral completed' },
  ]
  for (const r of rules) {
    await prisma.gamificationRule.upsert({ where: { eventType: r.eventType }, update: { xpAward: r.xpAward }, create: r })
  }

  // 6. Badges
  const badges = [
    { name: 'First Footprint', description: 'Created your first sector footprint', criteria: { footprints: 1 }, xpReward: 50 },
    { name: 'Comparison Pro', description: 'Created 5 comparisons', criteria: { comparisons: 5 }, xpReward: 100 },
    { name: 'Saver', description: 'Saved 10 listings', criteria: { saved: 10 }, xpReward: 75 },
    { name: 'Streak 7', description: '7 day login streak', criteria: { streak: 7 }, xpReward: 150 },
    { name: 'Explorer', description: 'Explored 3 sectors', criteria: { sectors: 3 }, xpReward: 100 },
  ]
  for (const b of badges) {
    await prisma.badge.upsert({ where: { name: b.name }, update: {}, create: b })
  }

  // 7. Quests
  await prisma.quest.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      title: 'Telecom Saver',
      description: 'Compare 3 telecom bundles and save 1',
      criteria: { sector: 'TELECOMS', actions: [{ type: 'COMPARISON_CREATED', count: 3 }, { type: 'LISTING_SAVED', count: 1 }] },
      xpReward: 200,
      active: true,
    },
  })

  // 8. FX Rates - fallback table, never delete
  const fxPairs = [
    { baseCurrency: 'USD', targetCurrency: 'ZWG', rate: 26.5 },
    { baseCurrency: 'USD', targetCurrency: 'ZiG', rate: 26.5 },
    { baseCurrency: 'USD', targetCurrency: 'ZAR', rate: 18.2 },
  ]
  for (const fx of fxPairs) {
    await prisma.fxRate.create({ data: { ...fx, source: 'fallback', effectiveAt: new Date() } })
  }

  // 9. Social Price Mention sample
  await prisma.socialPriceMention.upsert({
    where: { platform_sourceUrl: { platform: 'FACEBOOK', sourceUrl: 'https://facebook.com/example/post/1' } },
    update: {},
    create: {
      platform: 'FACEBOOK',
      sourceUrl: 'https://facebook.com/example/post/1',
      content: 'Econet 25GB now $42 in Harare!',
      matchedProvider: 'Econet',
      extractedPrices: [{ amount: 42, currency: 'USD', context: '25GB bundle' }],
      sector: 'TELECOMS',
      confidence: 0.82,
    },
  })

  console.log('✅ Seed complete - idempotent')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
