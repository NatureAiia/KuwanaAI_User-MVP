-- Ties public.users to Supabase Auth (auth.users) with the same intent as
-- a foreign key, but as triggers instead of a native FK constraint: Prisma
-- generates public.users.id as TEXT (its @default(uuid()) convention),
-- while auth.users.id is native uuid, and Postgres refuses a FK across
-- incompatible types outright ("cannot be implemented ... text and uuid").
-- Verified directly against this database before writing this migration.
--
-- This is NOT modeled in prisma/schema.prisma (Prisma has no concept of
-- another schema's table) and is Supabase-only — auth.users won't exist on
-- another platform. When porting off Supabase, this migration's DOWN
-- equivalent is simply: don't run it (or DROP the two triggers/functions).
--
-- SECURITY DEFINER + empty search_path per Supabase's own documented
-- pattern for auth.users triggers, to avoid search_path hijacking; every
-- reference is schema-qualified as a result.

-- 1. Writes to public.users must reference a real Auth user. Mirrors what
--    the FK would have enforced: onboarding already only ever writes
--    users.id from an authenticated session (see api/onboarding/route.ts),
--    so this should never fire in normal operation — it's a backstop.
CREATE OR REPLACE FUNCTION public.enforce_users_auth_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id::uuid) THEN
    RAISE EXCEPTION 'public.users.id % has no matching auth.users row', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_require_auth_id
BEFORE INSERT OR UPDATE OF id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_users_auth_id();

-- 2. Deleting the Auth user (e.g. via the Supabase dashboard) cascades to
--    the app-side row and, from there, everything that already
--    ON DELETE CASCADEs from public.users (profile, xp, badges,
--    comparisons, saved listings, recommendations, events, conversations,
--    notifications, consents, sector footprints, quest progress, streaks).
--    Without this, an Auth-side delete left all of that orphaned forever.
CREATE OR REPLACE FUNCTION public.handle_deleted_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id::text;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_deleted_auth_user();
