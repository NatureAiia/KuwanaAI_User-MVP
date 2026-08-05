-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('listing_approved', 'listing_rejected', 'listing_deleted', 'provider_linked', 'provider_unlinked', 'user_role_changed');

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at" DESC);

