-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

