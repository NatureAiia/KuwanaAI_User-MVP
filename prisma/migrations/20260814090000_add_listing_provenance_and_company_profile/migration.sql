-- AlterTable
ALTER TABLE "providers" ADD COLUMN "description" TEXT;

-- CreateEnum
CREATE TYPE "ListingUpdateSource" AS ENUM ('admin', 'scraper', 'corporate', 'seed');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "last_update_source" "ListingUpdateSource" NOT NULL DEFAULT 'seed';

-- CreateTable
CREATE TABLE "listing_update_logs" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "source" "ListingUpdateSource" NOT NULL,
    "actor_label" TEXT NOT NULL,
    "change_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_update_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_update_logs_listing_id_created_at_idx" ON "listing_update_logs"("listing_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "listing_update_logs" ADD CONSTRAINT "listing_update_logs_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
