-- CreateEnum
CREATE TYPE "QualityAxis" AS ENUM ('value', 'trust', 'availability', 'performance', 'resilience');

-- CreateEnum
CREATE TYPE "RegulatorReviewDecision" AS ENUM ('not_required', 'pending', 'approved', 'rejected', 'flagged');

-- AlterEnum
ALTER TYPE "CorporateRequestType" ADD VALUE 'new_field';

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'listing_rated';

-- AlterEnum
ALTER TYPE "Sector" ADD VALUE 'food';

-- AlterTable
ALTER TABLE "attribute_schema" ADD COLUMN     "consumer_label" TEXT,
ADD COLUMN     "quality_axis" "QualityAxis",
ADD COLUMN     "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "corporate_requests" ADD COLUMN     "change_percent" DOUBLE PRECISION,
ADD COLUMN     "previous_value_snapshot" JSONB,
ADD COLUMN     "regulator_decision" "RegulatorReviewDecision" NOT NULL DEFAULT 'not_required',
ADD COLUMN     "regulator_note" TEXT,
ADD COLUMN     "regulator_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "regulator_reviewed_by_email" TEXT,
ADD COLUMN     "risk_level" "RiskLevel";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "clarify" JSONB;

-- CreateTable
CREATE TABLE "quality_axis_config" (
    "axis" "QualityAxis" NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "default_weight" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "updated_by_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_axis_config_pkey" PRIMARY KEY ("axis")
);

-- CreateTable
CREATE TABLE "listing_quality_ratings" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "axis" "QualityAxis" NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_quality_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_quality_ratings_listing_id_axis_idx" ON "listing_quality_ratings"("listing_id", "axis");

-- CreateIndex
CREATE UNIQUE INDEX "listing_quality_ratings_listing_id_user_id_axis_key" ON "listing_quality_ratings"("listing_id", "user_id", "axis");

-- AddForeignKey
ALTER TABLE "listing_quality_ratings" ADD CONSTRAINT "listing_quality_ratings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_quality_ratings" ADD CONSTRAINT "listing_quality_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
