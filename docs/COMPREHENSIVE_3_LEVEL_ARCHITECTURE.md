# KuwanaAI — Comprehensive 3-Level Database Architecture
### Intelligent Comparison System for Banks, Telecoms, Schools, Universities, Insurance, Hotels & Hospitality


## 0. What We Are Building

**KuwanaAI** is an intelligent comparison platform where a consumer can:

- Compare **banks** (account fees, loan rates, mobile money), **telecoms** (data bundles, fibre), **schools/universities** (fees, programs), **insurance** (motor, health, funeral), **hotels & lodges** (room rates, amenities) — and more sectors without code changes.
- Ask natural language in AI chat: *“What’s cheapest 25GB bundle under $45? Compare CBZ, Stanbic, EcoBank and First Capital 4 banks side-by-side”* → AI grounds answer in real listings with citations.
- Compare **more than 2** items at once (e.g., 4 banks, 5 lodges).
- Get personalized recommendations based on footprint (budget, location, usage).

**Actors:**

1.  **Aiia Admin (Super Admin)** — owns platform, manages sectors, approves listings, sees all.
2.  **Corporate Admin** — e.g., Econet admin, CBZ bank admin, University of Zimbabwe admin. Manages only their provider listings, sees analytics for their sector.
3.  **User / Consumer** — Zimbabwe consumer comparing prices. Sees only PUBLISHED listings, saves, chats.
4.  **Regulator** — e.g., RBZ, POTRAZ, Insurance regulator. Read-only audit view, compliance reports, price indices per sector.
5.  **System Inputs (not humans):** 
    - **Scraper** — scrapes websites for bank fees, telco bundles, school fees, hotel prices.
    - **AI Data Input** — LLM extracts structured JSON from PDFs, social posts (Facebook), OCR documents.

All data lands in the database. The 3-level architecture ensures each actor sees only what they need, while underlying storage can evolve without breaking apps.

---

## 1. Three-Level Architecture — Quick Primer (from TutorialRide)

The classic ANSI/SPARC model has 3 layers to achieve **data independence**:

1.  **External Level (Level 3 in your link, Level 1 for users):** Individual user views. Each role sees a different window into the data. *Logical data independence* means if we add a new table to conceptual, external views don’t break.
2.  **Conceptual Level (Level 2):** Single unified logical view for the whole organization. Defines entities, relationships, constraints, no physical details. *The heart.*
3.  **Internal Level (Level 1 in your link):** How data is physically stored on disk — files, indexes, partitions, compression, vectors. *Physical data independence* means we can add an index or move to TimescaleDB without changing conceptual model.

KuwanaAI mapping:

| ANSI/SPARC Level | KuwanaAI Name | What it is |
|---|---|---|
| External | User Views | 4 interfaces + 2 bots, each with tailored API / DB views |
| Conceptual | Unified Logical Schema | 26+ models in Prisma, ERD, schema-driven catalog |
| Internal | Physical Storage | PostgreSQL 16, TimescaleDB hypertables, pgvector, Redis, Meilisearch, indexes |

---

## 2. EXTERNAL LEVEL — Who Sees What

This is the top level. No user sees the full DB. Each gets a **view** (API + SQL view). Implemented via `src/lib/catalog.ts` and `src/lib/tiers.ts` and role checks.

### 2.1 Aiia Admin (Platform Owner)
**Goal:** System administration, data quality, revenue.

**Sees:**
- All sectors (including COMING_SOON like healthcare), all listings in any status (DRAFT, PENDING_REVIEW, PUBLISHED, REJECTED)
- All users, corporate accounts, consents, waitlist
- Scraper health: `SocialPriceMention` raw feed, failed scrapes, confidence scores
- Gamification rules, badges, quests, FxRates
- Analytics warehouse tables (leaderboards, price indices)

**Can Do:**
- `PUBLISH / REJECT` listings (only role that can)
- Create sectors/categories/attribute schemas without DDL (INSERT into `AttributeSchemaField`)
- Edit `GamificationRule`, create `Quest`
- Override FxRate fallback
- View regulator audit logs

**API Example:**
```ts
// Admin-only gateway
AdminWrite.publishListing(id) // updates status DRAFT -> PUBLISHED
prisma.sectorConfig.create({ slug: 'hospitality', sector: 'HOSPITALITY', status: 'ACTIVE' })
```

**SQL View (conceptual):**
```sql
CREATE VIEW admin_all_listings AS SELECT * FROM listings; -- no status filter
```

### 2.2 Corporate Admin (Tenant)
**Goal:** Bank, telco, school, insurer, hotel owner managing their own listings.

**Sees:**
- Only `Provider` where `ownerId = their userId` OR `providerId` in their org
- Listings for their provider in DRAFT/PENDING/PUBLISHED/REJECTED
- Analytics for their sector: price trends vs competitors (anonymized), views, saves, recommendation count
- Cannot see other providers' drafts

**Can Do:**
- Submit listings: only `DRAFT` or `PENDING_REVIEW` (Zod enforces at API). Cannot directly publish.
- Upload bulk via CSV → lands in raw staging
- View their `ListingPriceHistory`

**Example: CBZ Bank Corporate Admin comparing**
```ts
// Sees 4 banks comparison dashboard, but can only edit CBZ
getPublishedListings({ sectorSlug: 'banking', providerSlug: 'cbz' }) // their own
getSectorIndex('BANKING') // Tier2 aggregate to see market average
```

### 2.3 Consumer User
**Goal:** Find cheapest/best fit.

**Sees:**
- **Only** `status = 'PUBLISHED'` listings (critical security rule in `catalog.ts`)
- `SectorConfig` where `status IN (ACTIVE, COMING_SOON)` — can create footprint for coming_soon
- Their own `SectorFootprint`, `SavedListing`, `Comparison`, `Conversation`, `UserXp`, `UserBadge`
- Recommendations, Notifications

**Can Do:**
- Create footprint per sector: `{ monthly_budget_usd, data_need_gb }` for telecoms, `{ loan_amount, tenure }` for banks, `{ checkin, guests, budget }` for hotels
- Create `Comparison` with **2 to 10 listingIds** (not limited to 2): `listingIds: ["uuid1","uuid2","uuid3","uuid4"]`
- Save listings, chat with AI: *“Compare these 4 universities for computer science fees”*
- Chat grounding: `Message.listingIds[]` array stores which listings answer came from

**Example Multi-Compare (4 banks):**
```json
POST /api/comparisons
{
  "sector": "BANKING",
  "title": "4 Banks - Student Account",
  "listingIds": ["cbz-student", "stanbic-student", "ecobank-student", "first-capital-student"],
  "scores": { "cbz-student": 85, "stanbic-student": 78 } // calculated by scoring.ts
}
```

**View Definition:**
```sql
CREATE VIEW consumer_published_listings AS 
SELECT * FROM listings WHERE status = 'PUBLISHED';
```

### 2.4 Regulator (RBZ, POTRAZ, Tourism Authority)
**Goal:** Compliance, market oversight, consumer protection.

**Sees:**
- Published listings per sector (read-only)
- Price history trends (Tier2 `listing_price_daily`, `sector_price_index`)
- Aggregated reports: average loan rate per bank, average data price per GB, hotel average nightly rate per city
- **No PII**: User emails masked, footprints aggregated, no access to messages content, only counts

**Can Do:**
- Export sector report CSV
- View `SocialPriceMention` flagged for anomaly (e.g., price gouging)
- Cannot edit listings

### 2.5 System Actors (Scraper & AI Input) — External but not human

**Scraper Bot:**
- Writes to `SocialPriceMention` (raw landing) with `platform`, `sourceUrl`, `extractedPrices` JSON, `confidence`
- Writes to staging table `raw_scraped_listings` (not in main schema, in `public` but filtered)
- Never writes directly to `listings` PUBLISHED. Aiia Admin or validation job promotes.

**AI Data Input:**
- LLM extracts: `FxRate` from RBZ PDF, `Listing.attributes` from hotel brochure PDF via OCR
- Writes to `Listing` as DRAFT with `source = 'ai_extracted'` + confidence, requires human review if confidence < 0.85

**Logical Data Independence in action:** If we add a new sector `HOSPITALITY` (hotels & lodges), external views for Consumer automatically include it when `SectorConfig.status=ACTIVE`, no change to Admin/Corporate views logic.

---

## 3. CONCEPTUAL LEVEL — The Unified Logical Schema (The Heart)

This is **one** schema for whole organization, independent of storage. Implemented as `prisma/schema.prisma` with 26 models, 10 enums.

### 3.1 Core Design Principles (from your outline, preserved)

1.  **One PostgreSQL schema `public`**, Prisma-only access (no raw SQL except migrations)
2.  **Schema-driven catalog:** New sector/category/attribute needs NO DDL. Just INSERT into `AttributeSchemaField`. Example: Adding `HOTELS` sector? Insert `SectorConfig`, then `Category` (e.g., `hotel-room`), then `AttributeSchemaField` rows like `bed_type: ENUM [Single, Double]`, `price_per_night: CURRENCY`.
3.  **JSON for flexible payloads:** `Listing.attributes`, `UserEvent.metadata`, `Quest.criteria`, `SocialPriceMention.extractedPrices` — validated by Zod in app, not rigid DB columns
4.  **Decimal for money**, `uuid()` PKs, Cascade for user-owned, SetNull for provider ownership
5.  **Consumer read gate:** Every consumer query filters `status='published'` in `catalog.ts`

### 3.2 The 7 Domains → Extended for Your New Sectors

| Domain | Models | Purpose for New Sectors |
|---|---|---|
| Identity & onboarding | User, UserProfile, SectorFootprint, Consent | Footprint per sector: bank budget, hotel dates/guests, school level |
| Sector Catalog | SectorConfig, Category, AttributeSchemaField, Provider, Listing, ListingPriceHistory | **Key:** Hospitality has categories `hotel-room`, `lodge-package` with attributes `amenities: STRING[]`, `star_rating: NUMBER` |
| Comparison Activity | Comparison, SavedListing, Recommendation, Notification | Comparison holds `listingIds: uuid[]` — supports 2 to 10 items, e.g., 4 banks |
| AI Chat | Conversation, Message | `Message.listingIds[]` grounds AI answer in real listings; vector search later |
| Gamification | GamificationRule, UserEvent, UserXp, UserStreak, Badge, UserBadge, Quest, UserQuestProgress | XP evaluated in-transaction with event, no queue |
| Intelligence Feed | SocialPriceMention, FxRate | Scraper + AI input land here, confidence, Fx fallback never deleted |
| Waitlist | WaitlistSignup | For COMING_SOON sectors |

### 3.3 Extended Sectors Enum (Now 12 to cover your ask)

```prisma
enum Sector {
  BANKING
  TELECOMS
  INSURANCE
  ENERGY
  RETAIL_GROCERY
  FUEL
  EDUCATION
  SCHOOLS // primary/secondary
  UNIVERSITIES
  HOUSING
  TRANSPORT
  HOSPITALITY // hotels & lodges
  HEALTHCARE
}
```

### 3.4 Key Entities Explained Simply

**SectorConfig:** The top-level bucket. `slug='banks'`, `sector=BANKING`, `status=ACTIVE`. If `status=COMING_SOON`, consumer can still submit footprint → signals demand.

**Category:** Under sector. Banking has `current-account`, `personal-loan`, `mortgage`. Hospitality has `hotel-room`, `lodge-package`, `conference-hall`. Each category has its own attribute shape.

**AttributeSchemaField:** The magic. Defines what fields a listing in that category must have. No ALTER TABLE needed.

Example for Hotels:
```
Category: hospitality / hotel-room
- key: star_rating, label: Star Rating, dataType: NUMBER, required: true
- key: price_per_night_usd, dataType: CURRENCY, required: true
- key: bed_type, dataType: ENUM, options: [Single, Double, King]
- key: amenities, dataType: STRING (JSON array)
- key: location_city, dataType: STRING
```

**Provider:** Who owns listing. CBZ Bank, Econet, University of Zimbabwe, Meikles Hotel. Has `ownerId` → Corporate Admin User. `onDelete: SetNull` so if corporate user deleted, listings stay but unowned.

**Listing:** The actual comparable item. `attributes: Json` holds values validated against `AttributeSchemaField`. `status` lifecycle: DRAFT (provider created) → PENDING_REVIEW → PUBLISHED (admin) → or REJECTED.

**ListingPriceHistory:** Append-only price changes. Will become TimescaleDB hypertable.

**Comparison:** User's multi-compare. `listingIds: Json` array of 2-10 uuids. Example: 4 banks student accounts. `scores` JSON holds calculated match score per listing based on footprint.

**Conversation/Message:** AI chat. `Message.role = USER/ASSISTANT`, `content = text`, `listingIds = [uuids]` that were used to answer. Allows citation: *“Answer based on CBZ, Stanbic listings”*.

**SocialPriceMention:** Raw intel from scraper. `matchedProvider` indexed, `extractedPrices` JSON like `[{ amount: 45, currency: USD, context: '25GB' }]`.

### 3.5 Relationships (Simplified)

```
User 1:1 UserProfile
User 1:N SectorFootprint (unique user+sector)
User 1:N Provider (as owner, SetNull)
SectorConfig 1:N Category 1:N AttributeSchemaField
SectorConfig 1:N Listing (denormalized) and Category 1:N Listing
Provider 1:N Listing
Listing 1:N ListingPriceHistory
User M:N Listing via SavedListing (composite PK)
User 1:N Comparison (holds multiple listingIds)
User 1:N Conversation 1:N Message
User 1:N UserEvent -> triggers UserXp, UserStreak, Badges, Quests in same transaction
```

**Why multi-compare >2 works:** `Comparison` doesn’t have a join table with 2 FKs; it stores `listingIds[]` JSON. So comparing 4 banks is just array of 4. Scoring loop iterates over array.

### 3.6 Integrity & Business Rules (App-layer, because DB can’t)

- Signup role = CONSUMER only. CORPORATE/REGULATOR granted by Aiia Admin checking `ADMIN_EMAILS` allowlist.
- Corporate can submit only DRAFT/PENDING_REVIEW (Zod).
- Consumer reads must go via `getPublishedListings()` which adds `status=PUBLISHED` filter. No direct `prisma.listing.findMany` in routes.
- XP/badges/quests evaluated inside same transaction as triggering `UserEvent`.

---

## 4. INTERNAL LEVEL — Physical Storage (How it’s really saved)

This level hides from conceptual. Developer can change physical without changing logical or external views → **Physical data independence**.

### 4.1 PostgreSQL 16 Base

- **Tables:** Each model = table in `public` schema. `Listing.attributes` stored as `jsonb` (TOASTed if large).
- **PKs:** `uuid` stored as 16 bytes, B-tree indexed.
- **Money:** `Decimal(12,2)` stored as exact numeric, not float.
- **Files on disk:** PostgreSQL stores data in 8KB pages, WAL logs for crash recovery, indexes as separate files.

### 4.2 Extensions for Scale

**TimescaleDB (for price history):**
```sql
SELECT create_hypertable('listing_price_history', 'recorded_at', chunk_time_interval => INTERVAL '7 days');
-- Each chunk = 7 days of price changes, compressed after 14 days (10x compression)
```
Why? Banking rates change daily, hotel prices change hourly. 10k listings × 365 days = 3.6M rows → hypertable makes time-range queries fast.

**pgvector (for AI chat):**
```sql
ALTER TABLE listings ADD COLUMN embedding vector(1536); -- OpenAI embedding size
CREATE INDEX ON listings USING hnsw (embedding vector_cosine_ops);
```
Stores semantic meaning of listing. Query *“cheap room with pool in Harare”* → embed query → cosine similarity search, even if listing doesn’t have keyword “cheap”.

**pg_trgm:** For fuzzy search in Meilisearch fallback.

### 4.3 Indexing Strategy (Internal)

- **B-tree (default):** PKs, FKs, `listings(status)`, `listings(category_id)`, `comparisons(user_id)`, `messages(conversation_id)`
- **Unique:** `users(email)`, `categories(sectorId, slug)`, `attribute_schemas(categoryId, key)`, `social_price_mentions(platform, sourceUrl)`
- **GIN:** On `attributes` JSONB for fast filtering: `WHERE attributes @> '{"bed_type":"King"}'`
- **HNSW (vector):** For AI similarity

### 4.4 Tier 2 & 3 Physical (Beyond DB Files)

- **Analytics schema `analytics`:** Materialized views `daily_price_mv`, `leaderboard_mv` refreshed nightly via `pg_cron`. Not real tables, but snapshots.
- **Redis (RAM):** Key-value cache, not persistent. `listing:{id}` → JSON, TTL 5 min. LRU eviction.
- **Meilisearch (inverted index on disk):** Full-text index of PUBLISHED listings only. Synced via worker when listing published.
- **Files on disk:** Scraper raw HTML, AI PDFs stored in S3, only extracted JSON in DB.

### 4.5 Physical Data Independence Example

We can:
- Add `CREATE INDEX CONCURRENTLY` on `listings(sector_id, status)` without changing Prisma schema or breaking external views.
- Switch `listing_price_history` to TimescaleDB hypertable — conceptual model still `ListingPriceHistory`, external views unchanged.
- Move embeddings from `vector(1536)` to `vector(3072)` (new model) — need migration but conceptual `Listing` still same.

---

## 5. END-TO-END DATA FLOW — From Scraper/AI to Consumer

```
[INPUT SOURCES]
Web Scraper (Python) -> scrapes CBZ fees page, Econet bundles, UZ fees, Meikles Hotel rates
    ↓ (every hour)
Raw Landing Zone: raw_scraped_listings table (immutable, timestamped, sourceUrl)
    ↓
Validation Job (Zod against AttributeSchemaField)
    - Deduplicate: check (platform, sourceUrl) unique
    - Cleanse: normalize USD, ZWG, ZiG via FxRate fallback
    - Anomaly detection: if price drops >50% vs yesterday, flag
    ↓
Canonical DB (public): Listing as DRAFT or PENDING_REVIEW, SocialPriceMention with confidence

[AI DATA INPUT]
PDF (RBZ rates), Facebook post, hotel brochure image
    ↓ OCR + LLM extraction
Structured JSON: { price_usd: 85, star_rating: 4 }
    ↓ confidence 0.82
Canonical DB: Listing DRAFT with source='ai_extracted'

[AIia Admin Reviews] -> PUBLISHED

[ETL to Analytics & Serving]
CDC (Debezium) -> analytics.listing_price_daily rollup
Worker -> Redis cache, Meilisearch index, pgvector embedding

[EXTERNAL VIEWS]
Consumer asks AI chat: "Compare 4 banks for student account under $10/month"
    -> Tier3 vector search finds 4 relevant PUBLISHED listings
    -> Message.listingIds = [id1,id2,id3,id4]
    -> LLM generates comparison table with citations
    -> Saved as Conversation+Message in Tier1
    -> Consumer UI shows side-by-side comparison of 4 banks
    -> Can save to SavedListing, create Comparison object for later

Regulator dashboard queries Tier2 sector_price_index for BANKING -> sees average fees trending up
Corporate Admin for Meikles Hotel sees only their listings + anonymized competitor avg from Tier2
```

---

## 6. SECURITY & ACCESS PER LEVEL

- **External:** Row-level via app: `requireAdmin()`, `requireCorporateOwner(providerId)`, `requireUser()`. Every consumer query adds `status=PUBLISHED`.
- **Conceptual:** FK constraints, unique constraints, enums prevent invalid data. No RLS in Postgres — Prisma service role is trust boundary (as per your deliberate decision).
- **Internal:** Postgres roles: `app_user` (read/write public), `analytics_reader` (read-only analytics), `scraper_writer` (write only raw tables). Redis ACL, Meilisearch API key search-only.

---

## 7. HOW TO BUILD FROM SCRATCH — Developer Roadmap

**Week 1 — Tier 1 OLTP:**
1. `npx prisma init`, copy `schema.prisma` from [original file](/mnt/data/prisma/schema.prisma)
2. Add sectors: banks, telecoms, schools, universities, insurance, hospitality (hotels & lodges)
3. `prisma migrate dev --name init`
4. Seed: sectors, categories, attribute schemas, providers
5. Build `catalog.ts` PUBLISHED gateway, `scoring.ts` Zod validators

**Week 2 — External Views & APIs:**
6. Build 4 Next.js route groups: `/admin` (Aiia), `/corporate/[provider]`, `/app` (consumer), `/regulator`
7. Implement `Comparison` creation with `listingIds[]` array (supports >2)
8. Implement AI chat endpoint: save Conversation, Message

**Week 3 — Scraper & AI Input:**
9. Scraper service writes to `social_price_mentions`, staging
10. AI extraction service writes DRAFT listings

**Week 4 — Tier 2 & 3:**
11. Enable TimescaleDB, pgvector, create `analytics` schema, materialized views
12. Deploy Redis + Meilisearch via `docker-compose.3tier.yml`
13. Workers: sync PUBLISHED listings to search and cache, generate embeddings

**Verification:**
- `npm test` scoring/eligibility/gamification
- Seed idempotency: run seed twice, no duplicates
- Migration replay from empty DB
- EXPLAIN ANALYZE on hot queries

---

## 8. Example Queries for Each Interface

**Consumer multi-compare 4 banks:**
```sql
SELECT title, attributes->>'monthly_fee' as fee, provider.name
FROM listings JOIN providers ON listings.provider_id = providers.id
WHERE listings.id IN ('uuid1','uuid2','uuid3','uuid4') AND status='PUBLISHED';
```

**Corporate Admin (Meikles Hotel):**
```sql
SELECT * FROM listings WHERE provider_id = 'meikles-hotel-id' AND status IN ('DRAFT','PENDING_REVIEW','PUBLISHED');
```

**Regulator (average hotel rate per city):**
```sql
SELECT (attributes->>'location_city') as city, AVG((attributes->>'price_per_night_usd')::decimal)
FROM analytics.listing_price_daily JOIN listings ON listing_id = listings.id
WHERE sector='HOSPITALITY' GROUP BY city;
```

**AI Chat grounding (vector):**
```sql
SELECT id, title, 1 - (embedding <=> $query_embedding::vector) as similarity
FROM listings WHERE status='PUBLISHED' ORDER BY embedding <=> $query_embedding LIMIT 5;
```

---

## Files to Use

- **OLTP Core:** [schema.prisma](/mnt/data/prisma/schema.prisma)
- **3-Tier Extension:** [schema.3tier.prisma](/mnt/data/prisma/schema.3tier.prisma) + [init.sql](/mnt/data/prisma/init.sql)
- **Gateways:** [catalog.ts](/mnt/data/src/lib/catalog.ts) (Tier1), [tiers.ts](/mnt/data/src/lib/tiers.ts) (Tier2+3)
- **Docs:** [database-architecture.md](/mnt/data/docs/database-architecture.md), [3-tier-database-architecture.md](/mnt/data/docs/3-tier-database-architecture.md)
- **This Comprehensive Doc:** [COMPREHENSIVE_3_LEVEL_ARCHITECTURE.md](/mnt/data/docs/COMPREHENSIVE_3_LEVEL_ARCHITECTURE.md)

This is the complete blueprint. A dev can start at External Level views, implement Conceptual models, then tune Internal storage without breaking upper layers — exactly the power of ANSI/SPARC 3-level architecture.