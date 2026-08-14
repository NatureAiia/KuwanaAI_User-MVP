-- AlterTable
ALTER TABLE "users" ADD COLUMN "wallet_balance_usd" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "wallet_balance_zig" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('initiated', 'pending', 'paid', 'cancelled', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "TopUpCurrency" AS ENUM ('USD', 'ZiG');

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "TopUpCurrency" NOT NULL DEFAULT 'USD',
    "status" "TopUpStatus" NOT NULL DEFAULT 'initiated',
    "paynow_reference" TEXT,
    "poll_url" TEXT,
    "paynow_status" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_reference_key" ON "wallet_transactions"("reference");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_transactions_status_created_at_idx" ON "wallet_transactions"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
