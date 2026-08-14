/**
 * One-off: promotes every ADMIN_EMAILS allowlist entry to role: admin, now
 * that admin is a real Role (see requireAdmin() in lib/auth.ts, which checks
 * both during the transition). Safe to re-run — skips users already on
 * role: admin and reports allowlist emails with no matching User row yet
 * (they'll get the role automatically on next login/signup via the
 * allowlist fallback, or can be created manually first).
 *
 *   npx tsx scripts/migrate-admin-role.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function migrateAdminRole() {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    console.log("[migrate-admin-role] ADMIN_EMAILS is empty — nothing to do.");
    return;
  }

  for (const email of allowlist) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.log(`[migrate-admin-role] "${email}" has no User row yet — skipping (allowlist fallback still covers them).`);
      continue;
    }
    if (user.role === "admin") {
      console.log(`[migrate-admin-role] "${email}" already role: admin — skipping.`);
      continue;
    }
    await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
    console.log(`[migrate-admin-role] "${email}": ${user.role} → admin.`);
  }
}

migrateAdminRole()
  .catch((err) => {
    console.error("[migrate-admin-role] failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
