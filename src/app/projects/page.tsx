import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

export default async function ProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/projects");

  const projects = await prisma.project.findMany({
    where: {
      workspace: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      status: { not: "DELETED" },
    },
    select: {
      id: true, name: true, description: true, framework: true, updatedAt: true,
      _count: { select: { files: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Link href="/chat" className="btn-primary">New project</Link>
      </div>

      {projects.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-16 text-center">
          <FolderKanban className="mb-4 h-10 w-10 text-ink-300" />
          <h2 className="text-lg font-medium">No projects yet</h2>
          <p className="mt-1 max-w-sm text-sm text-ink-500">
            Start your first project from the chat — describe an idea and Barada builds it with you.
          </p>
          <Link href="/chat" className="btn-primary mt-6">Open chat</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card group p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <h2 className="font-medium group-hover:text-accent-600">{p.name}</h2>
                {p.framework && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                    {p.framework}
                  </span>
                )}
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-sm text-ink-500">{p.description}</p>}
              <p className="mt-4 text-xs text-ink-400">
                {p._count.files} files · updated {new Date(p.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
