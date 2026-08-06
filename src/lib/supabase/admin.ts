import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only writes that must bypass
 * Storage RLS (e.g. provider image uploads) — mirrors how Prisma already
 * accesses every Postgres table here over a privileged connection, with
 * requireOwnProvider() as the actual authorization boundary rather than a
 * database-level policy. Never import this from a "use client" file.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase service role environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
