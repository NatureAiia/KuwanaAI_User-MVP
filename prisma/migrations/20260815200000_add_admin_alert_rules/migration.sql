-- CreateEnum
CREATE TYPE "AdminAlertMetric" AS ENUM ('total_providers', 'published_listings', 'pending_review_listings', 'open_investigations', 'pending_corporate_requests');

-- CreateTable
CREATE TABLE "admin_alert_rules" (
    "id" TEXT NOT NULL,
    "metric" "AdminAlertMetric" NOT NULL,
    "threshold" DECIMAL(12,2) NOT NULL,
    "direction" "AlertDirection" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_alert_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "admin_alert_rules" ADD CONSTRAINT "admin_alert_rules_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
