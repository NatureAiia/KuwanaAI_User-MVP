-- Track A (Supabase Auth -> Auth.js/NextAuth v5): additive columns only.
-- Existing rows get NULL passwordHash (Supabase owned password storage before
-- this) and NULL onboardingCompletedAt (all existing rows already completed
-- onboarding under the old flow; backfilled below rather than left null).

ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

-- Every row that already exists went through the pre-Auth.js onboarding flow,
-- so backfill onboarding_completed_at to createdAt rather than leaving it
-- null (null is reserved for genuinely abandoned post-migration signups).
UPDATE "users" SET "onboarding_completed_at" = "created_at" WHERE "onboarding_completed_at" IS NULL;
