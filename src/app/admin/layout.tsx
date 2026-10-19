import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireSuperAdmin();
  } catch {
    redirect("/");
  }
  return (
    <div className="pb-10">
      <AdminNav />
      {children}
    </div>
  );
}
