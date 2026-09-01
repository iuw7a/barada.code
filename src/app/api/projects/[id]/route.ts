import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  workspaceId: z.string().optional(), // move between workspaces
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const access = await requireProjectAccess(user.id, id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { files: true, chats: true } } },
    });
    if (!project) throw new ApiError(404, "项目不存在");
    return NextResponse.json({ project, role: access.role });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    // Renaming/moving requires MEMBER+.
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");
    const { name, description, workspaceId, status } = parsed.data;

    if (workspaceId) {
      const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!ws) throw new ApiError(404, "目标工作区不存在");
      if (ws.ownerId !== user.id) {
        const m = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: user.id } },
        });
        if (!m || m.role === "VIEWER") throw new ApiError(403, "权限不足");
      }
    }

    await prisma.project.update({
      where: { id },
      data: { ...(name ? { name: name.trim() } : {}), ...(description !== undefined ? { description } : {}), ...(workspaceId ? { workspaceId } : {}), ...(status ? { status } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const access = await requireProjectAccess(user.id, id, "ADMIN");
    // Only owner (or workspace admin) can delete.
    const project = await prisma.project.findUnique({ where: { id }, select: { ownerId: true } });
    if (!project) throw new ApiError(404, "项目不存在");
    if (project.ownerId !== user.id && access.role !== "OWNER") {
      throw new ApiError(403, "只有项目所有者可以删除");
    }
    await prisma.project.update({ where: { id }, data: { status: "DELETED" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
