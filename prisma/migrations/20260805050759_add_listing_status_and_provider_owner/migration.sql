-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'pending_review', 'published', 'rejected');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "status" "ListingStatus" NOT NULL DEFAULT 'published';

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "owner_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "providers_owner_user_id_key" ON "providers"("owner_user_id");

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

