import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import SecurityClient from "./SecurityClient";

export default async function SecuritySettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/settings/security");

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });

  return <SecurityClient sessions={sessions} />;
}
