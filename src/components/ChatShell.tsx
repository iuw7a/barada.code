import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import AppShell from "./AppShell";

export default async function ChatShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/chat");

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    select: { id: true, name: true, isPersonal: true },
    orderBy: { createdAt: "asc" },
  });

  const recents = await prisma.chat.findMany({
    where: { userId: user.id },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      workspaces={workspaces}
      activeWorkspaceId={workspaces.find((w) => w.isPersonal)?.id ?? workspaces[0]?.id ?? ""}
      recents={recents}
    >
      {children}
    </AppShell>
  );
}
