-- Four AdminAuditAction variants exist in schema.prisma and in
-- src/lib/adminAudit.ts, but no migration ever added them to the database
-- enum. Found by diffing a freshly migrated Postgres against the datamodel.
--
-- The effect is a 500 on four admin write paths, after the write has already
-- happened: /api/admin/discount-rules (POST and DELETE) and
-- /api/admin/economic-drivers (POST and DELETE) each create or delete their
-- row, then `await logAdminAction(...)` throws
--   invalid input value for enum "AdminAuditAction"
-- which is not caught. The admin sees a failure for an operation that
-- succeeded, and no audit entry is recorded for it.
--
-- Unrelated to the email-verification work in the migration before this one;
-- kept separate so it can be reverted on its own.
--
-- IF NOT EXISTS so re-running is a no-op, and because a database that had
-- these patched in by hand must not fail the deploy. Appending only — nothing
-- reads this enum by ordinal.
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'discount_rule_created';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'discount_rule_deleted';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'economic_driver_upserted';
ALTER TYPE "AdminAuditAction" ADD VALUE IF NOT EXISTS 'economic_driver_deleted';
