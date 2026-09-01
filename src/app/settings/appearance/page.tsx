import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import AppearanceClient from "./AppearanceClient";

export default async function AppearanceSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings/appearance");

  const row = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const json = (row?.json ?? {}) as { theme?: string };

  return <AppearanceClient initial={(json.theme ?? "system") as "light" | "dark" | "system"} />;
}
