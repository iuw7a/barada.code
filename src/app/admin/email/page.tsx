import { EmailCenter } from "./EmailCenter";
import { getAdminOrRedirect } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  await getAdminOrRedirect();
  return <EmailCenter />;
}
