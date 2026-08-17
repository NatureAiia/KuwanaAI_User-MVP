-- Kuwana — full database architecture (Postgres DDL)
--
-- Portable by design: standard Postgres only for every table (text ids
-- generated app-side, jsonb, native enums, btree/GIN indexes, plain FKs).
-- Verified 2026-08-06 against the live project (iguhrpbnnrdeplnbzyxc) via
-- pg_indexes/pg_policies/pg_extension: zero RLS policies, zero views, and
-- the only Supabase-only extension present (supabase_vault) is unused by
-- any table here. All 30 tables + every index/FK below run unmodified on
-- Supabase today and on plain Postgres / RDS / Neon / self-hosted later.
--
-- The one exception: two small triggers at the very end of this file that
-- link public.users to Supabase's own auth.users (see that section's
-- comment for why and how). Everything above that line is 100% portable;
-- skip only that final section when targeting non-Supabase Postgres.
--
-- HOW TO RUN
--   Fresh Supabase project (no repo/Node needed):
--     Supabase Dashboard → SQL Editor → New query → paste this file → Run.
--     Then seed reference data (sectors/categories/providers/listings/
--     gamification rules) with:
--       DATABASE_URL="<connection string>" npm run db:seed
--
--   From this repo (preferred once you have Node + the codebase checked out):
--     Point DATABASE_URL/DIRECT_URL at the target Postgres instance and run
--       npx prisma migrate deploy
--     This replays prisma/migrations/*/migration.sql, which is the
--     authoritative, versioned source this file is generated from — the two
--     are kept in sync (confirmed byte-for-byte equivalent via
--     `prisma migrate diff` against the live DB, 2026-08-06). If you ever
--     touch the schema going forward, edit prisma/schema.prisma and run a
--     migration — then regenerate this file with:
--       npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
--   Moving to a non-Supabase platform later:
--     Same file, minus the final trigger section (see above).
--
-- NOTE: id columns are TEXT (app-generated UUIDv4 strings via Prisma's
-- @default(uuid()), not Postgres-native `uuid`/gen_random_uuid()) — kept as
-- TEXT here to match exactly what's live and what Prisma's client sends.
--
-- The `images` column on `listings` (added via
-- prisma/migrations/20260806033248_add_listing_images) was applied to the
-- live database after the coordination gap above was noted — re-verified
-- 2026-08-06: column present live, `prisma migrate diff` reports zero
-- difference between prisma/schema.prisma and the live database.

BEGIN;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
CREATE TYPE "Role" AS ENUM ('consumer', 'corporate', 'regulator', 'provider');
CREATE TYPE "Sector" AS ENUM ('telecom', 'banking', 'insurance', 'education', 'healthcare', 'transport', 'utilities', 'pharmacy', 'electronics', 'fashion');
CREATE TYPE "SectorStatus" AS ENUM ('live', 'coming_soon');
CREATE TYPE "AttributeDataType" AS ENUM ('number', 'string', 'enum', 'boolean');
CREATE TYPE "FreshnessStatus" AS ENUM ('fresh', 'stale', 'unverified');
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'pending_review', 'published', 'rejected');
CREATE TYPE "NotificationType" AS ENUM ('price_drop', 'listing_approved', 'listing_rejected');
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');
CREATE TYPE "EventType" AS ENUM ('profile_completed', 'comparison_viewed', 'comparison_completed', 'recommendation_viewed', 'item_saved', 'action_taken', 'daily_visit', 'chat_started');
CREATE TYPE "SocialPlatform" AS ENUM ('telegram', 'reddit');
CREATE TYPE "AdminAuditAction" AS ENUM ('listing_approved', 'listing_rejected', 'listing_deleted', 'provider_linked', 'provider_unlinked', 'user_role_changed');

-- ---------------------------------------------------------------------
-- 4.1 Identity & onboarding
-- ---------------------------------------------------------------------
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'consumer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_profiles" (
    "user_id" TEXT NOT NULL,
    "age_range" TEXT,
    "occupation" TEXT,
    "location" TEXT,
    "full_name" TEXT,
    "nickname" TEXT,
    "social_platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "sector_footprints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "sector_footprints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL, -- 'research_use' | 'leaderboard_participation'
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- 4.2 Sector catalog (schema-driven)
-- ---------------------------------------------------------------------
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "SectorStatus" NOT NULL DEFAULT 'live',
    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attribute_schema" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_type" "AttributeDataType" NOT NULL,
    "unit" TEXT,
    "is_comparable" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "attribute_schema_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    -- Nullable: seeded reference providers have no login of their own — set
    -- only when a "provider" role account is admin-linked to self-manage
    -- this provider's listings.
    "owner_user_id" TEXT,
    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attributes" JSONB NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source_url" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    -- Real user reviews aren't collected anywhere in the app yet — these
    -- stay null/0 until that exists. Never backfilled/estimated.
    "rating" DECIMAL(2,1),
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "last_verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freshness_status" "FreshnessStatus" NOT NULL DEFAULT 'fresh',
    -- Provider self-submission workflow: draft -> pending_review ->
    -- published/rejected. Defaults to "published" so admin-created listings
    -- behave as before; only /provider submissions start at "draft".
    "status" "ListingStatus" NOT NULL DEFAULT 'published',
    "rejection_reason" TEXT,
    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "listing_price_history" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_price_history_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- 4.3 User comparison activity
-- ---------------------------------------------------------------------
CREATE TABLE "comparisons" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "listing_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comparisons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_listings" (
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("user_id","listing_id")
);

CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "score_version" TEXT NOT NULL DEFAULT 'v1',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- Caches /api/recommendations' AI output per distinct listing-set (not
-- per-user — a recommendation is a pure function of the listing set).
-- Deliberately separate from "recommendations" above, which stays the
-- audit-grade per-user record and is still written on every request,
-- cache hit or not. No FK: cache_key is a derived hash, not an entity id.
CREATE TABLE "recommendation_cache" (
    "cache_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recommendation_cache_pkey" PRIMARY KEY ("cache_key")
);

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'price_drop',
    "message" TEXT NOT NULL,
    "change_percent" DOUBLE PRECISION, -- only meaningful for price_drop
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- 4.4 AI chat assistant
-- ---------------------------------------------------------------------
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "listing_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- 6. Gamification
-- ---------------------------------------------------------------------
CREATE TABLE "user_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sector" "Sector",
    "event_type" "EventType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gamification_rules" (
    "event_type" "EventType" NOT NULL,
    "xp_value" INTEGER NOT NULL,
    "badge_trigger" JSONB,
    "quest_trigger" JSONB,
    CONSTRAINT "gamification_rules_pkey" PRIMARY KEY ("event_type")
);

CREATE TABLE "user_xp" (
    "user_id" TEXT NOT NULL,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "user_xp_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_badges" (
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge_id")
);

CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "active_from" TIMESTAMP(3) NOT NULL,
    "active_to" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_quest_progress" (
    "user_id" TEXT NOT NULL,
    "quest_id" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY ("user_id","quest_id")
);

CREATE TABLE "user_streaks" (
    "user_id" TEXT NOT NULL,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_active_date" DATE,
    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("user_id")
);

-- ---------------------------------------------------------------------
-- Free social-media price intelligence (read-only feed, admin-reviewed)
-- ---------------------------------------------------------------------
CREATE TABLE "social_price_mentions" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "channel" TEXT NOT NULL, -- Telegram channel username, or subreddit name
    "source_url" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3),
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "matched_provider" TEXT,
    "extracted_prices" JSONB NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "social_price_mentions_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- Live FX reference rates (units per 1 USD)
-- ---------------------------------------------------------------------
CREATE TABLE "fx_rates" (
    "code" TEXT NOT NULL,
    "per_usd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("code")
);

-- ---------------------------------------------------------------------
-- Admin audit log (no FK to acted-on rows — must survive their deletion)
-- ---------------------------------------------------------------------
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "target_type" TEXT NOT NULL, -- "listing" | "provider" | "user"
    "target_id" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- Rate limiting for public unauthenticated endpoints (self-cleaning:
-- the app deletes a key's own expired hits on every call)
-- ---------------------------------------------------------------------
CREATE TABLE "rate_limit_hits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL, -- e.g. "need-intake:203.0.113.5"
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- Healthcare "coming soon" waitlist
-- ---------------------------------------------------------------------
CREATE TABLE "waitlist_signups" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sector" TEXT NOT NULL, -- 'healthcare' for MVP; kept generic for future coming-soon sectors
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "sector_footprints_user_id_sector_key" ON "sector_footprints"("user_id", "sector");

-- Leaderboard query filters exactly this combination before joining UserXp.
CREATE INDEX "consents_consent_type_granted_idx" ON "consents"("consent_type", "granted");
CREATE UNIQUE INDEX "consents_user_id_consent_type_key" ON "consents"("user_id", "consent_type");

CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");
CREATE UNIQUE INDEX "categories_sector_id_slug_key" ON "categories"("sector_id", "slug");
CREATE UNIQUE INDEX "attribute_schema_category_id_key_key" ON "attribute_schema"("category_id", "key");
CREATE UNIQUE INDEX "providers_owner_user_id_key" ON "providers"("owner_user_id");

-- (category_id, status, price): the consumer catalog hot path. status
-- alone: the admin review queue filters by status with no category_id.
-- provider_id: the provider portal's "my listings" query.
CREATE INDEX "listings_category_id_status_price_idx" ON "listings"("category_id", "status", "price");
CREATE INDEX "listings_status_idx" ON "listings"("status");
CREATE INDEX "listings_provider_id_idx" ON "listings"("provider_id");

-- Price-trend/forecast reads a listing's full history ordered by time.
CREATE INDEX "listing_price_history_listing_id_recorded_at_idx" ON "listing_price_history"("listing_id", "recorded_at");

-- Every quest-progress check queries userId + a created_at range.
CREATE INDEX "comparisons_user_id_created_at_idx" ON "comparisons"("user_id", "created_at" DESC);
-- getAlsoCompared's listing_ids array-containment query needs a GIN index.
CREATE INDEX "comparisons_listing_ids_idx" ON "comparisons" USING GIN ("listing_ids");

CREATE INDEX "saved_listings_user_id_saved_at_idx" ON "saved_listings"("user_id", "saved_at" DESC);

CREATE INDEX "recommendations_listing_id_idx" ON "recommendations"("listing_id");
CREATE INDEX "recommendations_user_id_generated_at_idx" ON "recommendations"("user_id", "generated_at" DESC);

CREATE INDEX "recommendation_cache_expires_at_idx" ON "recommendation_cache"("expires_at");

CREATE INDEX "notifications_listing_id_idx" ON "notifications"("listing_id");
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at" DESC);
CREATE UNIQUE INDEX "notifications_user_id_listing_id_type_key" ON "notifications"("user_id", "listing_id", "type");

CREATE INDEX "conversations_user_id_created_at_idx" ON "conversations"("user_id", "created_at");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- Every badge-trigger check queries exactly this combination.
CREATE INDEX "user_events_user_id_event_type_created_at_idx" ON "user_events"("user_id", "event_type", "created_at" DESC);

-- Leaderboard ORDER BY total_xp DESC.
CREATE INDEX "user_xp_total_xp_idx" ON "user_xp"("total_xp" DESC);
CREATE UNIQUE INDEX "badges_name_key" ON "badges"("name");

-- quest-rotation checks "is anything active right now" via active_to.
CREATE INDEX "quests_active_to_idx" ON "quests"("active_to");

CREATE INDEX "social_price_mentions_matched_provider_idx" ON "social_price_mentions"("matched_provider");
CREATE INDEX "social_price_mentions_reviewed_discovered_at_idx" ON "social_price_mentions"("reviewed", "discovered_at" DESC);
CREATE UNIQUE INDEX "social_price_mentions_platform_source_url_key" ON "social_price_mentions"("platform", "source_url");

CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at" DESC);

CREATE INDEX "rate_limit_hits_key_created_at_idx" ON "rate_limit_hits"("key", "created_at");

CREATE UNIQUE INDEX "waitlist_signups_email_sector_key" ON "waitlist_signups"("email", "sector");

-- ---------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sector_footprints" ADD CONSTRAINT "sector_footprints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attribute_schema" ADD CONSTRAINT "attribute_schema_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listings" ADD CONSTRAINT "listings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_price_history" ADD CONSTRAINT "listing_price_history_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

-- The Supabase-only auth.users <-> public.users linking triggers that used to
-- live here were removed once Auth.js (NextAuth v5) replaced Supabase Auth —
-- see prisma/migrations/20260817040000_drop_supabase_auth_triggers. There is
-- no equivalent needed: public.users.id is no longer required to reference
-- any external auth-provider table.
