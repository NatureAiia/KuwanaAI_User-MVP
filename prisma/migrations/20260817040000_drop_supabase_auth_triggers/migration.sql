-- Track A (Supabase Auth -> Auth.js/NextAuth v5): drop the Supabase-only
-- auth.users <-> public.users linking triggers. enforce_users_auth_id()
-- raises on any INSERT into public.users with no matching auth.users row,
-- which every Auth.js-created user hits (no auth.users row is ever created
-- outside Supabase's own signUp()) — this must be dropped before
-- /api/auth/register ships. Guarded with to_regclass so this migration is a
-- no-op when applied to a non-Supabase Postgres (e.g. the in-cluster target),
-- where auth.users never existed.

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users';
  END IF;
END $$;

DROP TRIGGER IF EXISTS users_require_auth_id ON public.users;
DROP FUNCTION IF EXISTS public.enforce_users_auth_id() CASCADE;
DROP FUNCTION IF EXISTS public.handle_deleted_auth_user() CASCADE;
