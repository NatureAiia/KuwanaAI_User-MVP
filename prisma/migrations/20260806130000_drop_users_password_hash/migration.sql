-- Dead column: never read or written anywhere in src/ (grepped repo-wide
-- before dropping). Supabase Auth owns real credentials; this was a
-- local/dev fallback that was never wired up.
ALTER TABLE "users" DROP COLUMN "password_hash";
