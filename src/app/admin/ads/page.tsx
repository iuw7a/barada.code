import { AdsManager } from "./AdsManager";
import { getAdminOrRedirect, getSetting } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  await getAdminOrRedirect();
  const rules = await getSetting("adRules", { showToFree: true, showToPro: false, showToGuests: true, maxPerSession: 2, maxPerDay: 5, enabled: true });
  return <AdsManager initialRules={rules} />;
}
