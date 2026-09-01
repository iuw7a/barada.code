import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/auth/guard";

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

const RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * Returns the caller's role in the workspace. Throws 403 if not a member.
 * Workspace owner is always OWNER.
 */
export async function requireWorkspaceRole(
  userId: string,
  workspaceId: string,
  min: Role = "VIEWER"
): Promise<Role> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new ApiError(404, "工作区不存在");

  let role: Role | null = null;
  if (ws.ownerId === userId) {
    role = "OWNER";
  } else {
    const m = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    role = (m?.role as Role) ?? null;
  }
  if (!role) throw new ApiError(403, "无权访问该工作区");
  if (!atLeast(role, min)) throw new ApiError(403, "权限不足");
  return role;
}

/** Throws 403 unless the user can read the project (via workspace membership or public visibility). */
export async function requireProjectAccess(
  userId: string,
  projectId: string,
  min: Role = "VIEWER"
): Promise<{ projectId: string; workspaceId: string; role: Role }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true, visibility: true, ownerId: true },
  });
  if (!project) throw new ApiError(404, "项目不存在");

  if (project.visibility === "PUBLIC") {
    return { projectId, workspaceId: project.workspaceId, role: "VIEWER" };
  }
  const role = await requireWorkspaceRole(userId, project.workspaceId, min);
  return { projectId, workspaceId: project.workspaceId, role };
}
