import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Users, Plus } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=/workspace/${id}`);

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      projects: { select: { id: true, name: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" } },
    },
  });
  if (!workspace) redirect("/chat");

  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: user.id } },
  });
  const isOwner = workspace.ownerId === user.id;
  if (!isOwner && !membership) redirect("/chat");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{workspace.name}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {workspace.isPersonal ? "Personal workspace" : `${workspace.members.length} member${workspace.members.length === 1 ? "" : "s"}`}
            {" · "}
            {workspace.projects.length} project{workspace.projects.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/chat" className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="h-4 w-4" /> New project
        </Link>
      </div>

      {/* Projects */}
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          <FolderKanban className="h-4 w-4" /> Projects
        </h2>
        {workspace.projects.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mt-1 text-xs text-ink-400">
              Start a chat and describe your idea — projects created here appear in this list.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {workspace.projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="card group p-4 transition-shadow hover:shadow-md"
              >
                <p className="font-medium group-hover:text-accent-600">{p.name}</p>
                <p className="mt-1 text-xs text-ink-400">
                  Updated {p.updatedAt.toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Members */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-400">
          <Users className="h-4 w-4" /> Members
        </h2>
        <div className="card divide-y divide-ink-100 dark:divide-ink-800">
          {workspace.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-600 text-xs font-semibold text-white">
                  {(m.user.name ?? m.user.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.user.name ?? m.user.email}</p>
                  <p className="text-xs text-ink-400">{m.user.email}</p>
                </div>
              </div>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                {ROLE_LABEL[m.role] ?? m.role}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
