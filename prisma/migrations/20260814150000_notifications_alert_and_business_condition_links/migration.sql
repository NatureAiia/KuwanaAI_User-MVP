-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'alert_threshold_crossed';
ALTER TYPE "NotificationType" ADD VALUE 'business_condition_review_due';

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "listing_id" DROP NOT NULL;
ALTER TABLE "notifications" ADD COLUMN "alert_rule_id" TEXT;
ALTER TABLE "notifications" ADD COLUMN "business_condition_id" TEXT;

-- CreateIndex
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_alert_rule_id_type_key" UNIQUE ("user_id", "alert_rule_id", "type");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_business_condition_id_type_key" UNIQUE ("user_id", "business_condition_id", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_business_condition_id_fkey" FOREIGN KEY ("business_condition_id") REFERENCES "business_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
