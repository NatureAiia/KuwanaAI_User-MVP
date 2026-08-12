import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminFooter } from "@/components/admin/AdminFooter";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  if (!admin) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader />
      <div className="flex-1">{children}</div>
      <AdminFooter />
    </div>
  );
}
