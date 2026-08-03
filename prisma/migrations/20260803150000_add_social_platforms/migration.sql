-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "social_platforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
