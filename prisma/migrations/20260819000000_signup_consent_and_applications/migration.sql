-- Signup/onboarding redesign: a mandatory pre-signup consent gate (shown to
-- every role, replacing the old consumer-only `health` step's terms
-- checkbox), and an `applicationStatus` trail for corporate/provider/
-- regulator applicants pending a future admin review UI.

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('not_applicable', 'pending', 'approved', 'rejected');

-- AlterEnum
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction
-- block in older versions; Prisma's own generated migrations for this
-- codebase already use this exact form (see 20260815200000-era enum
-- additions), so it's kept consistent with that here.
ALTER TYPE "NotificationType" ADD VALUE 'user_application_submitted';

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "consent_accepted_at" TIMESTAMP(3),
  ADD COLUMN "application_status" "ApplicationStatus" NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN "verification_document_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "custom_interface_requested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "custom_interface_notes" TEXT,
  ADD COLUMN "reviewed_by_email" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "applicant_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_applicant_user_id_type_key" ON "notifications"("user_id", "applicant_user_id", "type");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
