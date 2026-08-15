-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspended_reason" TEXT;
