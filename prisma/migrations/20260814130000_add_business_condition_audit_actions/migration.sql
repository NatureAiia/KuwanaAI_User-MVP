-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'business_condition_created';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'business_condition_updated';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'business_condition_deleted';
