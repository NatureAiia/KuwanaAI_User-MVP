import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRoleSelect } from "@/components/admin/UserRoleSelect";
import { SearchableSection } from "@/components/admin/SearchableSection";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Users</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        {users.length} user(s). Corporate/Provider/Regulator can now self-register with a verified
        email (see src/lib/orgVerification.ts) — use this to correct a mis-set role or grant access
        manually when verification can&apos;t apply.
      </p>

      <div className="mt-6">
      <SearchableSection placeholder="Search users…">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-surface-raised text-left">
              <th className="p-3 font-medium text-text-muted">Email</th>
              <th className="p-3 font-medium text-text-muted">Joined</th>
              <th className="p-3 font-medium text-text-muted">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-search-row className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{u.email}</td>
                <td className="p-3 text-text-secondary">{u.createdAt.toLocaleDateString()}</td>
                <td className="p-3">
                  <UserRoleSelect userId={u.id} currentRole={u.role} />
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-text-muted">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </SearchableSection>
      </div>
    </div>
  );
}
