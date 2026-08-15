-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('open', 'in_progress', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "listing_investigations" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'open',
    "assigned_to_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "listing_investigations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_investigations_provider_id_status_idx" ON "listing_investigations"("provider_id", "status");

-- CreateIndex
CREATE INDEX "listing_investigations_listing_id_idx" ON "listing_investigations"("listing_id");

-- AddForeignKey
ALTER TABLE "listing_investigations" ADD CONSTRAINT "listing_investigations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_investigations" ADD CONSTRAINT "listing_investigations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_investigations" ADD CONSTRAINT "listing_investigations_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

