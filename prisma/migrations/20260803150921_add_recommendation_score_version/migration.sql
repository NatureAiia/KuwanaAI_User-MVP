-- AlterTable
ALTER TABLE "recommendations" ADD COLUMN     "score_version" TEXT NOT NULL DEFAULT 'v1';
