-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'advert_created';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'advert_updated';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'advert_deleted';
