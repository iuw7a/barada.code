import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { requireProjectAccess } from "@/lib/permissions";
import ProjectWorkspace from "./ProjectWorkspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=/projects/${id}`);

  await requireProjectAccess(user.id, id);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      files: { select: { path: true, isDir: true, size: true }, orderBy: { path: "asc" } },
    },
  });
  if (!project) redirect("/projects");

  return (
    <ProjectWorkspace
      project={{
        id: project.id,
        name: project.name,
        framework: project.framework,
        language: project.language,
      }}
      files={project.files}
    />
  );
}
