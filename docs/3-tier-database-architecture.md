# KuwanaAI — 3-Tier Database Architecture

> Evolution of the single-schema `public` design into OLTP → Analytics → Serving

![3-Tier Diagram](/mnt/data/resource/kuwanaai_3tier_architecture.webp)

## Overview

Your original outline was **Tier 1** perfected. For production scale in Zimbabwe (volatile prices, social intel, AI chat), you need separation of concerns:

```
TIER 1: OLTP Core (PostgreSQL 16 + PgBouncer)  → Source of Truth
  ↓ CDC / Debezium + pg_cron ETL
TIER 2: Analytics Warehouse (TimescaleDB + analytics schema) → Time-series, aggregates
  ↓ Batch ETL + Embedding generation
TIER 3: Serving Layer (Redis + Meilisearch + pgvector) → <10ms reads, AI RAG
```

## Tier 1 — OLTP Core (What you already have)

**Schema:** `public` (26 models) — the `schema.prisma` we built
**Purpose:** ACID transactions, user writes, provider submissions
**Workload:** Millions of writes, low-latency writes

Models:
- Identity: User, UserProfile, SectorFootprint, Consent
- Catalog: SectorConfig, Category, AttributeSchemaField, Provider, Listing, ListingPriceHistory
- Comparison: Comparison, SavedListing, Recommendation, Notification
- AI Chat: Conversation, Message
- Gamification: GamificationRule, UserEvent, UserXp, UserStreak, Badge, UserBadge, Quest, UserQuestProgress
- Intelligence: SocialPriceMention (raw landing), FxRate
- Waitlist: WaitlistSignup

**Principles preserved:**
- One Prisma client is trust boundary, no RLS
- `Listing.status = 'published'` gate in `src/lib/catalog.ts`
- Decimal for money, uuid PKs, Cascade/SetNull
- Gamification in-transaction, no queue
- Admin = ADMIN_EMAILS allowlist

**Infrastructure:**
- PostgreSQL 16 Primary + 1 Replica (streaming replication)
- PgBouncer transaction pooling
- `supabaseAuthId` mirror for Supabase Auth

---

## Tier 2 — Analytics Warehouse (NEW)

**PostgreSQL schema:** `analytics`
**Extension:** TimescaleDB for hypertables, `pg_cron` for refresh
**Purpose:** Time-series price analysis, leaderboards, rollups, scoring

### Why separate?
- Tier 1 price history (90-day) will explode: 10k listings × 90 days = 900k rows, × 1 year = 3.6M. Don't run analytics on OLTP.
- Leaderboards, daily price averages, FX-adjusted ZWG/ZiG trends need columnar scans.

### Tables (new)

```prisma
// prisma/schema.analytics.prisma additions
model ListingPriceDaily {
  @@schema("analytics")
  id         String   @id @default(uuid()) @db.Uuid
  listingId  String   @map("listing_id") @db.Uuid
  date       DateTime @db.Date
  avgPrice   Decimal  @db.Decimal(12,2)
  minPrice   Decimal
  maxPrice   Decimal
  currency   String
  count      Int
  @@unique([listingId, date])
  @@map("listing_price_daily")
}

model SectorPriceIndex {
  @@schema("analytics")
  id        String   @id @default(uuid())
  sector    Sector
  date      DateTime @db.Date
  indexValue Decimal @map("index_value") @db.Decimal(12,4) // vs baseline 100
  fxAdjusted Boolean @default(false)
  @@unique([sector, date])
  @@map("sector_price_index")
}

model UserEventDaily {
  @@schema("analytics")
  userId    String   @map("user_id") @db.Uuid
  date      DateTime @db.Date
  eventType EventType
  count     Int
  xpEarned  Int
  @@id([userId, date, eventType])
  @@map("user_event_daily")
}

model LeaderboardSnapshot {
  @@schema("analytics")
  id        String   @id @default(uuid())
  period    String   // daily, weekly, monthly
  date      DateTime @db.Date
  ranking   Json     // [{ userId, xp, level }]
  createdAt DateTime @default(now())
  @@unique([period, date])
  @@map("leaderboard_snapshots")
}
```

### Hypertables (SQL)
```sql
-- Enable TimescaleDB
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert listing_price_history to hypertable
SELECT create_hypertable('public.listing_price_history', 'recorded_at', chunk_time_interval => INTERVAL '7 days');

-- Compression policy
ALTER TABLE public.listing_price_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'listing_id'
);
SELECT add_compression_policy('public.listing_price_history', INTERVAL '14 days');
```

### Materialized Views
```sql
-- In analytics schema
CREATE MATERIALIZED VIEW analytics.daily_price_mv AS
SELECT listing_id, DATE(recorded_at) as day, AVG(price) as avg_price, MIN(price), MAX(price)
FROM public.listing_price_history GROUP BY 1,2;

CREATE MATERIALIZED VIEW analytics.leaderboard_mv AS
SELECT user_id, SUM(total_xp) as xp, RANK() OVER (ORDER BY SUM(total_xp) DESC)
FROM public.user_xp GROUP BY user_id;

-- Refresh via pg_cron
SELECT cron.schedule('refresh-daily-mv', '0 2 * * *', $$REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.daily_price_mv$$);
```

### ETL: Tier 1 → Tier 2
- **CDC:** Debezium postgres connector → Kafka topic `kuwana.listing_price_history`
- **Batch:** dbt job hourly: public → analytics rollups
- **Guarantee:** Idempotent, FX fallback never deleted (from your deliberate decisions)

---

## Tier 3 — Serving Layer (Low-latency)

**Purpose:** <10ms reads, semantic search, AI grounding
**Stack:** Redis 7 + Meilisearch + pgvector (or Qdrant)

### 3a. Redis Cache
```
Keys:
- listing:{id} -> JSON (published only)
- sector:{slug}:categories -> JSON
- user:{id}:xp, streak, footprint
- leaderboard:weekly -> ZSET
- fx:USD:ZWG -> rate

TTL: 5m for listings, 1h for sectors, 60s for leaderboard
Invalidation: On Tier1 write, publish via LISTEN/NOTIFY -> worker clears key
```

### 3b. Meilisearch (Search index)
- Index: `listings` — only where status=published
- Fields: title, description, attributes (flattened), provider.name, category.name
- Filters: sector, category, provider, price range (facets)
- Sync: On publish, worker upserts to Meilisearch

### 3c. pgvector — AI Chat RAG
```sql
CREATE EXTENSION vector;

-- Add to public schema
ALTER TABLE public.listings ADD COLUMN embedding vector(1536);
CREATE INDEX ON public.listings USING ivfflat (embedding vector_cosine_ops);

-- Conversation memory
CREATE TABLE analytics.message_embeddings (
  id uuid PRIMARY KEY,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);
```

Flow for AI chat:
1. User asks: "Cheapest 20GB in Harare?"
2. Tier 3: embed query → vector search in listings (cosine) + Meilisearch keyword
3. Return top 5 listingIds → inject into `Message.listingIds[]` grounding
4. LLM answers with citations
5. Save Conversation, Message in Tier 1 (source of truth)

---

## Data Flow End-to-End

1. **Write:** User creates footprint → Tier1 `SectorFootprint` + `UserEvent` + `UserXp` in transaction
2. **CDC:** Debezium captures `listing_price_history` insert → Tier2 hypertable chunk
3. **Aggregate:** pg_cron 2am refreshes `daily_price_mv`, `leaderboard_mv`
4. **Serve:** ETL worker → Redis `listing:{id}`, Meilisearch doc, pgvector embedding
5. **Read:** Next.js API → `src/lib/tiers.ts` checks Redis first, fallback to Tier1 `getPublishedListings()`, then caches
6. **AI:** Chat endpoint → Tier3 vector search → Tier1 messages persisted

## 3-Tier Code Gateway

```ts
// src/lib/tiers.ts
import { getPublishedListings } from './catalog' // Tier1
import { redis } from './redis' // Tier3
import { meili } from './meili' // Tier3

export async function getListings3Tier(opts) {
  const cacheKey = `listings:${opts.sectorSlug}:${opts.search}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // Tier3 search if query
  if (opts.search) {
    const hits = await meili.index('listings').search(opts.search, { filter: `sector = ${opts.sectorSlug}` })
    const ids = hits.hits.map(h => h.id)
    const listings = await getPublishedListings({ ...opts, ids }) // Tier1 filtered
    await redis.setex(cacheKey, 300, JSON.stringify(listings))
    return listings
  }

  const listings = await getPublishedListings(opts) // Tier1 source of truth
  await redis.setex(cacheKey, 300, JSON.stringify(listings))
  return listings
}
```

## Security per Tier

- Tier1: Supabase Auth → `ADMIN_EMAILS` allowlist, Prisma service role trust boundary, no RLS
- Tier2: Read-only role `analytics_reader` for dashboards, no PII (user_id pseudonymized)
- Tier3: Redis ACL, Meilisearch API key scoped to search only, pgvector via Tier1 connection

## Performance Targets

- Tier1 write p95 < 100ms, 1k TPS via PgBouncer
- Tier2 refresh < 5min for daily MVs, hypertable compression 10x
- Tier3 read p95 < 10ms (Redis), search < 50ms (Meilisearch), vector < 100ms (pgvector HNSW)

## Deliberate Decisions (carried over + new)

- Healthcare COMING_SOON but footprint allowed → still in Tier1, excluded from Tier3 index until ACTIVE
- FX fallback never deleted → Tier2 SectorPriceIndex has fxAdjusted flag, falls back to Tier1 fallback table
- No queue for gamification → stays in Tier1 transaction, Tier2 aggregates async
- Listing attributes loose JSON → Tier3 Meilisearch flattening handles it without DDL

## Migration Path from Current

1. Deploy Tier1 as-is (you have it)
2. Add `analytics` schema + TimescaleDB extension, create hypertable
3. Add Redis + Meilisearch docker, add workers for sync
4. Add pgvector column, backfill embeddings with script
5. Switch `src/lib/catalog.ts` to call `src/lib/tiers.ts` wrapper
