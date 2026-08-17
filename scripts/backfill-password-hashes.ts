/**
 * One-off script: backfill users.password_hash from Supabase's auth.users
 * ahead of the Auth.js (NextAuth v5) cutover. bcryptjs reads Supabase's own
 * bcrypt hashes unmodified, so this is a straight copy, not a re-hash.
 *
 * Run once against the pre-cutover database, then delete/archive — not a
 * recurring job. Requires DATABASE_URL to point at a role with SELECT on
 * auth.users (the Supabase direct-connection URL already used by this app
 * has that).
 *
 *   npx tsx scripts/backfill-password-hashes.ts
 */
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const { rows: authUsers } = await client.query<{ id: string; encrypted_password: string | null }>(
      `SELECT id, encrypted_password FROM auth.users`,
    );
    const { rows: appUsers } = await client.query<{ id: string; email: string }>(
      `SELECT id, email FROM public.users`,
    );

    const authById = new Map(authUsers.map((u) => [u.id, u.encrypted_password]));
    const appIds = new Set(appUsers.map((u) => u.id));

    let updated = 0;
    const orphanedAppUsers: string[] = [];
    for (const appUser of appUsers) {
      const hash = authById.get(appUser.id);
      if (!hash) {
        orphanedAppUsers.push(`${appUser.id} (${appUser.email})`);
        continue;
      }
      await client.query(`UPDATE public.users SET password_hash = $1 WHERE id = $2`, [hash, appUser.id]);
      updated++;
    }

    const orphanedAuthUsers = authUsers.filter((u) => !appIds.has(u.id)).map((u) => u.id);

    console.log(`Backfilled ${updated}/${appUsers.length} public.users rows from auth.users.`);
    if (orphanedAppUsers.length) {
      console.warn(
        `WARNING: ${orphanedAppUsers.length} public.users row(s) have no matching auth.users row ` +
          `and remain locked out (password_hash still null) until a password-reset flow exists:\n` +
          orphanedAppUsers.map((s) => `  - ${s}`).join("\n"),
      );
    }
    if (orphanedAuthUsers.length) {
      console.warn(
        `NOTE: ${orphanedAuthUsers.length} auth.users row(s) have no matching public.users row ` +
          `(abandoned pre-migration signups) — nothing to backfill for them:\n` +
          orphanedAuthUsers.map((id) => `  - ${id}`).join("\n"),
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
