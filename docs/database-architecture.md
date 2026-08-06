/**
 * KuwanaAI — Database Architecture
 * docs/database-architecture.md
 * One PostgreSQL schema (public), Prisma-only access
 */

# KuwanaAI Database Architecture

## 1. Purpose & Principles
- **One schema**: `public` in PostgreSQL, accessed only via Prisma Client. No raw SQL except migrations.
- **Schema-driven catalog**: `AttributeSchemaField` rows define shape per category. Adding a sector/category = INSERT, not DDL.
- **JSON for flexible payloads**: `Listing.attributes`, `UserEvent.metadata`, `Quest.criteria`, `SocialPriceMention.extractedPrices`, `Badge.criteria`
- **Money**: `Decimal(12,2)` for prices, `Decimal(12,6)` for FX rates. Never Float.
- **PKs**: `uuid()` everywhere via `@default(uuid()) @db.Uuid`
- **Deletes**: Cascade for user-owned (profile, footprints, consents, comparisons, saved, events, xp, streak, badges, quests, notifications, conversations). SetNull for provider ownership (`Provider.owner`, `Listing.providerId`)
- **Consumer read gate**: Every consumer-facing query filters `Listing.status = 'published'` — enforced in `src/lib/catalog.ts`

## 2. Logical Domains (7)

| Domain | Models |
|---|---|
| Identity & onboarding | User, UserProfile, SectorFootprint, Consent |
| Sector catalog | SectorConfig, Category, AttributeSchemaField, Provider, Listing, ListingPriceHistory |
| Comparison activity | Comparison, SavedListing, Recommendation, Notification |
| AI chat | Conversation, Message |
| Gamification | GamificationRule, UserEvent, UserXp, UserStreak, Badge, UserBadge, Quest, UserQuestProgress |
| Intelligence feed | SocialPriceMention, FxRate |
| Waitlist | WaitlistSignup |

## 3. Entity Relationship Map

```
User 1:1 UserProfile (Cascade)
User 1:N SectorFootprint (userId, sector) unique
User 1:N Consent (userId, type) unique
User 1:N Provider as owner (SetNull)

Catalog spine:
SectorConfig 1:N Category (sectorId, slug unique)
Category 1:N AttributeSchemaField (categoryId, key unique)
Category 1:N Listing
SectorConfig 1:N Listing (sectorId SetNull for flexibility)
Provider 1:N Listing (providerId SetNull)
Listing 1:N ListingPriceHistory (listingId, recordedAt indexed)

User M:N Listing via SavedListing (composite PK [userId, listingId])
User 1:N Comparison, Recommendation, Notification
Notification unique [userId, listingId, type]

Conversation 1:N Message (message.listingIds[] uuid[] for grounding)
User 1:N Conversation

Gamification:
GamificationRule keyed by EventType (unique)
User 1:N UserEvent -> in-transaction evaluation
User 1:1 UserXp, UserStreak
Badge M:N User via UserBadge (userId, badgeId unique)
Quest M:N User via UserQuestProgress (userId, questId unique)
```

## 4. Enums

- **Role**: CONSUMER, PROVIDER, CORPORATE, REGULATOR (ADMIN is email allowlist, not enum)
- **Sector (10)**: TELECOMS, ENERGY, INSURANCE, BANKING, HEALTHCARE, RETAIL_GROCERY, FUEL, EDUCATION, HOUSING, TRANSPORT
- **SectorStatus**: ACTIVE, COMING_SOON, DISABLED (healthcare = COMING_SOON seeded, but footprint allowed)
- **AttributeDataType**: STRING, NUMBER, BOOLEAN, ENUM, CURRENCY, DATE, RANGE
- **FreshnessStatus**: FRESH, STALE, EXPIRED
- **ListingStatus**: DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED, ARCHIVED
- **NotificationType**: PRICE_DROP, NEW_LISTING, DEAL_EXPIRING, RECOMMENDATION, SYSTEM, STREAK_REMINDER
- **ChatRole**: USER, ASSISTANT, SYSTEM
- **EventType (8)**: FOOTPRINT_CREATED, COMPARISON_CREATED, LISTING_SAVED, CONVERSATION_STARTED, RECOMMENDATION_VIEWED, PROFILE_COMPLETED, DAILY_LOGIN, REFERRAL_COMPLETED
- **SocialPlatform**: FACEBOOK, TWITTER, WHATSAPP, TELEGRAM, TIKTOK, INSTAGRAM

## 5. Constraints & Indexes

**Natural keys (dedupe)**:
- users.email, users.supabaseAuthId
- sector_configs.slug, sector_configs.sector
- categories(sectorId, slug)
- attribute_schemas(categoryId, key)
- sector_footprints(userId, sector)
- consents(userId, type)
- badges.name
- waitlist_signups(email, sector)
- social_price_mentions(platform, sourceUrl)
- gamification_rules.eventType
- fx_rates(baseCurrency, targetCurrency, effectiveAt)

**Explicit indexes**:
- social_price_mentions(matchedProvider)
- listing_price_history(listingId, recordedAt)
- listings(categoryId), listings(providerId), listings(status), listings(sectorId)
- comparisons(userId), messages(conversationId), user_events(userId, eventType)
- fx_rates(baseCurrency, targetCurrency)

> Gap note from v1: Originally only `social_price_mentions(matchedProvider)` had explicit index, rest relied on PK/FK B-trees. Added hot-path indexes in migration `add_hot_path_indexes` — keep this in mind for EXPLAIN ANALYZE.

## 6. Integrity Rules (enforce in-app)

1. **Signup role**: Self-service = CONSUMER only. CORPORATE/REGULATOR/PROVIDER granted via admin route with `requireAdmin()` checking `ADMIN_EMAILS` allowlist. No DB constraint.
2. **Provider submissions**: Zod schema restricts to `DRAFT | PENDING_REVIEW`. Admin-only `PUBLISHED | REJECTED` via `src/lib/catalog.ts:AdminWrite`.
3. **XP/badges/quests**: Evaluated in-transaction with triggering `UserEvent` — no queue. `prisma.$transaction([createEvent, updateXp, checkBadges])`
4. **Published filter**: `src/lib/catalog.ts` is sole gateway. No direct `prisma.listing.findMany` in routes.
5. **Supabase Auth**: Auth owns identity. `users.supabaseAuthId` mirrors it. On signup webhook, upsert User.

## 7. Build Process

1. **Requirements** — KUWANA_MVP_BUILD_PLAN.md §4/§6
2. **Conceptual** — 7 domains, ERD per domain, merge
3. **Logical** — PK, FKs, @@unique/@@index, enum vs JSON choice
4. **Physical** — `prisma/schema.prisma` + `prisma migrate dev --name <change>`
5. **Seed** — deterministic `prisma/seed.ts`: upsert sectors/categories/schemas/providers/listings + 90-day history + rules/badges/quest
6. **Access layer** — `src/lib/catalog.ts`
7. **Security** — Document split: Supabase Auth owns identity, Prisma service role is trust boundary, no Postgres RLS configured
8. **Performance** — EXPLAIN ANALYZE on: compare view, dashboard specials, leaderboard
9. **Verification** — `npm test` (scoring/eligibility/gamification), seed idempotency (`seed x2`), migration replay from empty DB
10. **Document** — this file + ERD

## 8. Deliberate Decisions (don't "fix")

- Admin = `ADMIN_EMAILS` env allowlist, not `Role.ADMIN` — prevents privilege escalation via DB
- Healthcare seeded `COMING_SOON` but `SectorFootprint` allows CONSUMER to submit footprint for it (waitlist + interest signal)
- `Listing.attributes` and `AttributeSchemaField` are loose JSON + zod-validated at app layer, not strictly typed at DB layer — enables no-DDL sector addition
- No background queue; gamification runs in trigger transaction for immediate feedback
- FX rates override static defaults per-currency; fallback table never deleted, only superseded by newer `effectiveAt`
- All consumer reads filter `PUBLISHED` — even if listing exists

## 9. Security Model

```
Supabase Auth (JWT) -> Middleware verifies -> prisma.user.findUnique({ supabaseAuthId })
                    -> src/lib/catalog.ts filters PUBLISHED
                    -> Admin check: email in ADMIN_EMAILS
Postgres RLS: NOT CONFIGURED — Prisma service role is trust boundary
Future: enable RLS if direct client DB access needed
```

## 10. Example Queries

```ts
// Consumer: telecom bundles under $50
await getPublishedListings({ sectorSlug: 'telecoms', search: '25GB' })

// Admin publish
await prisma.$transaction(async (tx) => {
  await tx.listing.update({ where: { id }, data: { status: 'PUBLISHED' } })
  await tx.userEvent.create({ data: { userId: adminId, eventType: 'LISTING_SAVED', metadata: { listingId: id } } })
})

// Gamification in-transaction
await prisma.$transaction(async (tx) => {
  await tx.userEvent.create({ data: { userId, eventType: 'FOOTPRINT_CREATED' } })
  const rule = await tx.gamificationRule.findUnique({ where: { eventType: 'FOOTPRINT_CREATED' } })
  await tx.userXp.upsert({ where: { userId }, update: { totalXp: { increment: rule!.xpAward } }, create: { userId, totalXp: rule!.xpAward } })
})
```

## 11. Migrations

- `init`: full schema
- `add_hot_path_indexes`: adds indexes from §5 gap
- Future: add `@@index([status, categoryId])` composite for compare view after EXPLAIN ANALYZE
