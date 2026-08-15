-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'price_cap_breached';

-- CreateTable
CREATE TABLE "price_cap_rules" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "cap_value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_cap_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_cap_rules_category_id_idx" ON "price_cap_rules"("category_id");

-- AddForeignKey
ALTER TABLE "price_cap_rules" ADD CONSTRAINT "price_cap_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_cap_rules" ADD CONSTRAINT "price_cap_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "price_cap_rule_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_price_cap_rule_id_fkey" FOREIGN KEY ("price_cap_rule_id") REFERENCES "price_cap_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_price_cap_rule_id_type_key" ON "notifications"("user_id", "price_cap_rule_id", "type");
