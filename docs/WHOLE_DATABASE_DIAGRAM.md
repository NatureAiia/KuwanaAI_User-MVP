# Whole Database Architectural Design — KuwanaAI

This document contains the complete visual blueprint.

## Diagram 1: Full 3-Level Architecture (Input → External → Conceptual → Internal)

![Whole Architecture](/mnt/data/resource/kuwanaai_database_architecture.webp)

**What it shows:**
- **Input Sources Layer:** Web Scraper (banks, telecoms, schools, universities, insurance, hotels) + AI Data Input (LLM extraction, OCR, normalization)
- **External Level (4 interfaces):** Aiia Admin, Corporate Admin, Consumer User, Regulator
- **Conceptual Level (7 domains):** 
  - Identity Domain: User, UserProfile, SectorFootprint, Consent
  - Sector Catalog Domain: SectorConfig, Category, AttributeSchemaField, Provider, Listing, ListingPriceHistory
  - Comparison Domain: Comparison, SavedListing, Recommendation, Notification
  - AI Chat Domain: Conversation, Message
  - Gamification Domain: GamificationRule, UserEvent, UserXp, UserStreak, Badge, UserBadge, Quest, UserQuestProgress
  - Intelligence Domain: SocialPriceMention, FxRate
  - Waitlist Domain: WaitlistSignup
- **Internal Level:** PostgreSQL (OLTP primary), TimescaleDB Hypertables (price history), Intelligence Domain, pgvector (768-dim embeddings for AI chat), Redis Cache (sessions, comparison results), Meilisearch (full-text search)
- **Data Flow:** Input → Ingestion → Validation → Embedding generation → Redis cache → APIs serve external interfaces
- **Legend:** Data flow, FK relationships, Time-series data

Security: Row-level security, JWT/OAuth2/RBAC, observability via Prometheus, scalability via read replicas + PgBouncer.

## Diagram 2: Detailed Entity Relationship Diagram (ERD)

![ERD](/mnt/data/resource/kuwanaai_erd_diagram.webp)

**Key Relationships:**
- User 1:N UserProfile (1:1), SectorFootprint, Consent, UserXp, UserStreak
- User 1:N UserEvent, Notification, WaitlistSignup
- SectorConfig 1:N Category 1:N AttributeSchemaField
- SectorConfig 1:N Provider (optional)
- Provider 1:N Listing, Listing 1:N ListingPriceHistory
- User M:N Listing via SavedListing (composite PK user_id, listing_id)
- User 1:N Comparison (holds listingIds[] for >2 banks comparison)
- Comparison 1:N Recommendation
- User 1:N Conversation 1:N Message (Message.listingIds[] grounds AI answers)
- UserEvent triggers UserXp, Badge, Quest progress in transaction
- FxRate unique on (base_currency, quote_currency, as_of)

**All PKs = UUID, FKs = UUID, money = Decimal(12,2) or Numeric(18,6) for FX, embeddings = vector(1536)**

## Diagram 3: System Data Flow (from earlier)

![Data Flow](/mnt/data/resource/kuwanaai_system_flow.webp)

Shows how scraper + AI input feed raw landing zone → validation (schema validation against AttributeSchemaField, dedup, anomaly detection) → canonical PostgreSQL (sectors: Banks, Telecom, Education, Insurance, Hotels) → Redis low-latency cache → AI Chat comparison engine (multi-compare 4 banks) + Vector DB (natural language price comparison) → 4 user interfaces.

## Diagram 4: ANSI/SPARC 3-Level Mapping

![ANSI SPARC](/mnt/data/resource/ansi_sparc_kuwanaai_diagram.webp)

Maps classic DBMS 3-level architecture to KuwanaAI:
- External = 4 views (Admin, Corporate, Consumer, Regulator)
- Conceptual = Unified logical schema (26 tables)
- Internal = Physical files, indexes, hypertables, vectors, cache

This achieves Logical Data Independence (add hospitality sector without breaking external views) and Physical Data Independence (add TimescaleDB or pgvector index without changing conceptual).

## How to Use This for Development

1. Start with Diagram 2 ERD — create tables in order: Identity → Sector → Provider → Listing → Comparison → AI Chat → Gamification → Intelligence
2. Use Diagram 1 for infrastructure — setup PostgreSQL, enable pgvector, TimescaleDB, Redis, Meilisearch
3. Use Diagram 3 for data pipeline — scraper and AI input jobs
4. Implement external views per role using catalog.ts gateway that enforces status='PUBLISHED' for consumers
5. Test multi-compare: create Comparison with 4 bank listingIds, score via scoring.ts

All files: prisma/schema.prisma (Tier1), prisma/schema.3tier.prisma (full), src/lib/catalog.ts, src/lib/tiers.ts, docker-compose.3tier.yml
