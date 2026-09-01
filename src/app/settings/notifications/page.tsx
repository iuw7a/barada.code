import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

export default async function NotificationsSettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings/notifications");

  const row = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const json = (row?.json ?? {}) as {
    notifications?: { email?: boolean; project?: boolean; ai?: boolean; workspace?: boolean };
  };

  return (
    <NotificationsClient
      initial={{
        email: json.notifications?.email ?? true,
        project: json.notifications?.project ?? true,
        ai: json.notifications?.ai ?? true,
        workspace: json.notifications?.workspace ?? true,
      }}
    />
  );
}
