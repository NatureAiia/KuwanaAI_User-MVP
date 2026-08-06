-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "rating" DECIMAL(2,1),
ADD COLUMN     "review_count" INTEGER NOT NULL DEFAULT 0;
