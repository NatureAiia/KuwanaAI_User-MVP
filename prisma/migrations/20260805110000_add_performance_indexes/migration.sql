-- Performance indexes for the hot query paths.
--
-- PostgreSQL does not index foreign keys automatically and Prisma does not
-- add them either, so before this migration every catalog read, every
-- gamification cooldown check and every "others also compared" lookup was a
-- sequential scan.
--
-- These run as plain CREATE INDEX, which takes a lock that blocks writes to
-- each table for the duration. That is the right trade at the current data
-- size (seconds at most). It will not be once these tables are large:
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction, and Prisma wraps
-- each migration in one, so a future index on a big table needs to be applied
-- by hand outside the migration runner.

-- CreateIndex
CREATE INDEX "comparisons_user_id_created_at_idx" ON "comparisons"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comparisons_listing_ids_idx" ON "comparisons" USING GIN ("listing_ids" array_ops);

-- CreateIndex
CREATE INDEX "consents_consent_type_granted_idx" ON "consents"("consent_type", "granted");

-- CreateIndex
CREATE INDEX "conversations_user_id_created_at_idx" ON "conversations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "listing_price_history_listing_id_recorded_at_idx" ON "listing_price_history"("listing_id", "recorded_at");

-- CreateIndex
CREATE INDEX "listings_category_id_status_price_idx" ON "listings"("category_id", "status", "price");

-- CreateIndex
CREATE INDEX "listings_provider_id_idx" ON "listings"("provider_id");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_listing_id_idx" ON "notifications"("listing_id");

-- CreateIndex
CREATE INDEX "quests_active_to_idx" ON "quests"("active_to");

-- CreateIndex
CREATE INDEX "recommendations_user_id_generated_at_idx" ON "recommendations"("user_id", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "recommendations_listing_id_idx" ON "recommendations"("listing_id");

-- CreateIndex
CREATE INDEX "saved_listings_user_id_saved_at_idx" ON "saved_listings"("user_id", "saved_at" DESC);

-- CreateIndex
CREATE INDEX "social_price_mentions_reviewed_discovered_at_idx" ON "social_price_mentions"("reviewed", "discovered_at" DESC);

-- CreateIndex
CREATE INDEX "user_events_user_id_event_type_created_at_idx" ON "user_events"("user_id", "event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_xp_total_xp_idx" ON "user_xp"("total_xp" DESC);

