-- CreateEnum
CREATE TYPE "ScrapeTrigger" AS ENUM ('cron', 'admin_manual');

-- CreateEnum
CREATE TYPE "ScrapeItemStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditAction" ADD VALUE 'scrape_item_approved';
ALTER TYPE "AdminAuditAction" ADD VALUE 'scrape_item_rejected';
ALTER TYPE "AdminAuditAction" ADD VALUE 'scrape_source_created';

-- CreateTable
CREATE TABLE "scrape_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraped_items" (
    "id" TEXT NOT NULL,
    "source_id" TEXT,
    "category_id" TEXT,
    "source_url" TEXT NOT NULL,
    "triggered_by" "ScrapeTrigger" NOT NULL,
    "raw_content" TEXT NOT NULL,
    "extracted_data" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "suggested_provider_id" TEXT,
    "suggested_listing_id" TEXT,
    "status" "ScrapeItemStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_email" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraped_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scrape_sources_enabled_idx" ON "scrape_sources"("enabled");

-- CreateIndex
CREATE INDEX "scraped_items_status_discovered_at_idx" ON "scraped_items"("status", "discovered_at" DESC);

-- CreateIndex
CREATE INDEX "scraped_items_source_id_idx" ON "scraped_items"("source_id");

-- AddForeignKey
ALTER TABLE "scrape_sources" ADD CONSTRAINT "scrape_sources_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "scrape_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_suggested_provider_id_fkey" FOREIGN KEY ("suggested_provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_suggested_listing_id_fkey" FOREIGN KEY ("suggested_listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

