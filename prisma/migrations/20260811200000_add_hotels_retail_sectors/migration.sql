-- AlterEnum
-- Adds the two new live sectors (Hotels, Retail & Groceries) to the Sector
-- enum used by sector_footprints.user_events. Adding values is safe on
-- Postgres 12+ — no table rewrite, no dependency on existing rows.

ALTER TYPE "Sector" ADD VALUE 'hotels';
ALTER TYPE "Sector" ADD VALUE 'retail';
