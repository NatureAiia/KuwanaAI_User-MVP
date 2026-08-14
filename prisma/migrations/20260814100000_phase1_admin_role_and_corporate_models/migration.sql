-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('category', 'listing');

-- CreateEnum
CREATE TYPE "BusinessConditionCategory" AS ENUM ('regulatory', 'competitor', 'macro');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('avg_price', 'listing_count', 'trending_down', 'trending_up', 'unverified_count');

-- CreateEnum
CREATE TYPE "AlertDirection" AS ENUM ('above', 'below');

-- CreateEnum
CREATE TYPE "ChatFeedbackRating" AS ENUM ('up', 'down');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'admin';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "allowed_features" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "discount_rules" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "category_id" TEXT,
    "listing_id" TEXT,
    "percent_off" DECIMAL(5,2) NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "economic_drivers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'ZW',
    "value" DECIMAL(10,4) NOT NULL,
    "previous_value" DECIMAL(10,4),
    "period" DATE NOT NULL,
    "currency_code" TEXT,
    "updated_by_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economic_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_conditions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "BusinessConditionCategory" NOT NULL,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'medium',
    "review_cycle_days" INTEGER,
    "notes" TEXT,
    "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sector_slug" TEXT,
    "assigned_to_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "threshold" DECIMAL(12,2) NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'inapp',
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","type","channel")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT,
    "label" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_feedback" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" "ChatFeedbackRating" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discount_rules_provider_id_created_at_idx" ON "discount_rules"("provider_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "discount_rules_listing_id_idx" ON "discount_rules"("listing_id");

-- CreateIndex
CREATE INDEX "economic_drivers_period_idx" ON "economic_drivers"("period" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "economic_drivers_name_region_period_key" ON "economic_drivers"("name", "region", "period");

-- CreateIndex
CREATE INDEX "business_conditions_category_idx" ON "business_conditions"("category");

-- CreateIndex
CREATE INDEX "business_conditions_risk_level_idx" ON "business_conditions"("risk_level");

-- CreateIndex
CREATE INDEX "alert_rules_provider_id_idx" ON "alert_rules"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "api_keys"("hashed_key");

-- CreateIndex
CREATE INDEX "api_keys_provider_id_idx" ON "api_keys"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_feedback_message_id_user_id_key" ON "chat_feedback"("message_id", "user_id");

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_conditions" ADD CONSTRAINT "business_conditions_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_feedback" ADD CONSTRAINT "chat_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_feedback" ADD CONSTRAINT "chat_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

