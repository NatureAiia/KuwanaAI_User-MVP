-- DropForeignKey
ALTER TABLE "listing_investigations" DROP CONSTRAINT "listing_investigations_listing_id_fkey";

-- AlterTable: listing_id becomes optional (SetNull instead of Cascade — see
-- schema.prisma), and listing_name is added as a snapshot so a case still
-- displays sensibly after its listing is gone.
ALTER TABLE "listing_investigations" ALTER COLUMN "listing_id" DROP NOT NULL;
ALTER TABLE "listing_investigations" ADD COLUMN "listing_name" TEXT;

-- Backfill listing_name for every existing row from its still-present listing.
UPDATE "listing_investigations" li
SET "listing_name" = l."name"
FROM "listings" l
WHERE li."listing_id" = l."id";

-- Anything left null (shouldn't happen today — every existing row's listing
-- still exists — but a NOT NULL column needs every row filled regardless).
UPDATE "listing_investigations" SET "listing_name" = 'Unknown listing' WHERE "listing_name" IS NULL;

ALTER TABLE "listing_investigations" ALTER COLUMN "listing_name" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "listing_investigations" ADD CONSTRAINT "listing_investigations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
