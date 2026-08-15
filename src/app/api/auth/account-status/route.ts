import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";

/**
 * Deliberately bypasses requireUser() (lib/auth.ts), which treats a
 * suspended account as "not signed in" everywhere else in the app — this is
 * the one place that needs to tell the two apart, so the login page can show
 * "your account was deactivated" instead of silently bouncing back to
 * /login with no explanation right after a successful Supabase sign-in.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return privateJson({ suspended: false });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { accountStatus: true } });
  return privateJson({ suspended: dbUser?.accountStatus === "suspended" });
}
