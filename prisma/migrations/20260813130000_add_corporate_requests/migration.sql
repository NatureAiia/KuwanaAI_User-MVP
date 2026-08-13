-- CreateEnum
CREATE TYPE "CorporateRequestType" AS ENUM ('edit', 'new_listing');

-- CreateEnum
CREATE TYPE "CorporateRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditAction" ADD VALUE 'corporate_request_approved';
ALTER TYPE "AdminAuditAction" ADD VALUE 'corporate_request_rejected';
ALTER TYPE "AdminAuditAction" ADD VALUE 'corporate_domain_linked';

-- AlterTable
ALTER TABLE "providers" ADD COLUMN "corporate_domain" TEXT;

-- CreateTable
CREATE TABLE "corporate_requests" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "submitted_by_user_id" TEXT NOT NULL,
    "type" "CorporateRequestType" NOT NULL,
    "listing_id" TEXT,
    "category_id" TEXT,
    "proposed_data" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CorporateRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by_email" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_corporate_domain_key" ON "providers"("corporate_domain");

-- CreateIndex
CREATE INDEX "corporate_requests_provider_id_idx" ON "corporate_requests"("provider_id");

-- CreateIndex
CREATE INDEX "corporate_requests_status_created_at_idx" ON "corporate_requests"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "corporate_requests" ADD CONSTRAINT "corporate_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_requests" ADD CONSTRAINT "corporate_requests_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_requests" ADD CONSTRAINT "corporate_requests_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_requests" ADD CONSTRAINT "corporate_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
