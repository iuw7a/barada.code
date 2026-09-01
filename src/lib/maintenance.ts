import { redirect } from "next/navigation";
import { getSetting, getAdmin } from "@/lib/admin";

/** Redirects regular users to /maintenance when enabled. Admins bypass. */
export async function maintenanceGate() {
  const cfg = await getSetting<{ enabled: boolean }>("maintenance", { enabled: false });
  if (!cfg.enabled) return;
  const admin = await getAdmin();
  if (!admin) redirect("/maintenance");
}
