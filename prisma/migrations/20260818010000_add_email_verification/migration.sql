-- Two-step email verification at signup.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Backfill. Every account that existed before this shipped is treated as
-- verified, because requireUser() rejects a row with a NULL here: without
-- this line, deploying the migration would sign out the entire user base for
-- a control they were never offered a chance to satisfy.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL;

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_created_at_idx" ON "email_verification_codes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "email_verification_codes_expires_at_idx" ON "email_verification_codes"("expires_at");

-- No foreign key to "users" on purpose: the Supabase auth user exists from
-- signUp() onward, but this app's users row is only written when onboarding
-- completes, and verification is what gates onboarding. A FK would make the
-- table unwritable at the one moment it is used.

-- 20260818000000_enable_row_level_security swept every table that existed at
-- the time. This one is created afterwards, so it has to opt in itself — a
-- table added later would otherwise silently be the only one in the schema
-- reachable by the anon/authenticated PostgREST roles, and it holds
-- verification material.
ALTER TABLE "email_verification_codes" ENABLE ROW LEVEL SECURITY;
