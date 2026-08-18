-- Row Level Security as defence in depth.
--
-- WHAT THIS DOES AND DOES NOT CHANGE
--
-- This app's trust boundary is the application: every query goes through
-- Prisma on a privileged connection, and every route authenticates and scopes
-- its own reads (see src/lib/auth.ts and the audit in SECURITY_AUDIT.md).
-- That does not change here, and this migration is not an attempt to move
-- authorization into the database — doing that properly means running app
-- queries on a per-user connection, which is a rewrite of the data layer.
--
-- What it does is close the gap underneath. Supabase hands every browser a
-- publishable/anon key that can talk to PostgREST directly, as the `anon` or
-- `authenticated` role. Until now those roles had nothing standing between
-- them and the tables except the absence of a public API — enabling RLS with
-- no permissive policy makes the answer an empty set instead.
--
-- WHY THERE ARE NO POLICIES
--
-- With RLS enabled and no policy present, Postgres denies every row to any
-- role that is not the table owner and does not hold BYPASSRLS. That is
-- exactly the intent: deny by default. Adding a policy here would be adding a
-- way in, not a protection.
--
-- WHY THE APPLICATION IS UNAFFECTED
--
-- Two independent reasons, either sufficient:
--   1. Supabase's `service_role` holds BYPASSRLS.
--   2. The migration/app role owns these tables, and a table owner is exempt
--      from its own RLS unless FORCE ROW LEVEL SECURITY is set. It is not set
--      here, deliberately — forcing it would lock out the very connection the
--      app runs on and take the whole app down.
--
-- Verified against a real Postgres before merging: with this applied, the
-- owning role still reads every table, while a separate unprivileged role
-- holding an explicit SELECT grant reads zero rows.
--
-- Written as a loop over the live catalogue rather than 55 hand-written
-- statements, so a table added later cannot be silently left out.

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      -- Ordinary and partitioned tables only. Views, sequences and foreign
      -- tables either cannot carry RLS or inherit it from what they read.
      AND c.relkind IN ('r', 'p')
      -- Prisma's own bookkeeping. Leaving it alone keeps `migrate deploy`
      -- working on connections that do not bypass RLS.
      AND c.relname <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.table_name);
  END LOOP;
END
$$;
