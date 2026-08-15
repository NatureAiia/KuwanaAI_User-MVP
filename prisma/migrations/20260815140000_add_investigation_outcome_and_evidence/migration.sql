-- CreateEnum
CREATE TYPE "InvestigationOutcome" AS ENUM ('none', 'warning', 'fine', 'suspension');

-- AlterTable
ALTER TABLE "listing_investigations" ADD COLUMN "outcome" "InvestigationOutcome" NOT NULL DEFAULT 'none',
ADD COLUMN "evidence_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
