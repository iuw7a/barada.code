import ChatShell from "@/components/ChatShell";
import { maintenanceGate } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  await maintenanceGate();
  return <ChatShell>{children}</ChatShell>;
}
