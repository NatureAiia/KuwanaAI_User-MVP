-- Backfilled migration file: this SQL was already applied directly to the
-- live database (indexes matching these already exist there) outside of
-- `prisma migrate dev`, which left local migration history out of sync with
-- the database. This file reconstructs it — using the `@@index` directives
-- already present in prisma/schema.prisma for these models as the source of
-- truth — and is registered via `prisma migrate resolve --applied` rather
-- than executed, so it only ever runs for real against a fresh database
-- (e.g. CI, a new developer's shadow DB) that doesn't have these indexes yet.

-- CreateIndex
CREATE INDEX "comparisons_user_id_created_at_idx" ON "comparisons"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comparisons_listing_ids_idx" ON "comparisons" USING GIN ("listing_ids");

-- CreateIndex
CREATE INDEX "consents_consent_type_granted_idx" ON "consents"("consent_type", "granted");

-- CreateIndex
CREATE INDEX "conversations_user_id_created_at_idx" ON "conversations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "listing_price_history_listing_id_recorded_at_idx" ON "listing_price_history"("listing_id", "recorded_at");

-- CreateIndex
CREATE INDEX "listings_category_id_status_price_idx" ON "listings"("category_id", "status", "price");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");

-- CreateIndex
CREATE INDEX "listings_provider_id_idx" ON "listings"("provider_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_listing_id_idx" ON "notifications"("listing_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at" DESC);

-- CreateIndex
CREATE INDEX "quests_active_to_idx" ON "quests"("active_to");

-- CreateIndex
CREATE INDEX "recommendations_listing_id_idx" ON "recommendations"("listing_id");

-- CreateIndex
CREATE INDEX "recommendations_user_id_generated_at_idx" ON "recommendations"("user_id", "generated_at" DESC);

-- CreateIndex
CREATE INDEX "saved_listings_user_id_saved_at_idx" ON "saved_listings"("user_id", "saved_at" DESC);

-- CreateIndex
CREATE INDEX "social_price_mentions_reviewed_discovered_at_idx" ON "social_price_mentions"("reviewed", "discovered_at" DESC);

-- CreateIndex
CREATE INDEX "user_events_user_id_event_type_created_at_idx" ON "user_events"("user_id", "event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "user_xp_total_xp_idx" ON "user_xp"("total_xp" DESC);
