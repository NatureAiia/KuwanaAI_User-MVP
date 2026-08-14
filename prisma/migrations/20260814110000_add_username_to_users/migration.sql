-- Add a unique, user-picked username handle to replace the old free-text
-- "full name" signup field. Added nullable first so existing rows can be
-- backfilled with a collision-proof value (email local-part + short id
-- suffix) before the NOT NULL + UNIQUE constraints are applied.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

UPDATE "users"
SET "username" = lower(split_part("email", '@', 1)) || '_' || substr("id", 1, 8)
WHERE "username" IS NULL;

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
