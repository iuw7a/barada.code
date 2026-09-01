import { getAdminOrRedirect } from "@/lib/admin";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminOrRedirect();
  return <AdminShell adminName={admin.name} role={admin.role as "ADMIN" | "SUPER_ADMIN"}>{children}</AdminShell>;
}
