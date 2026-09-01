import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  workspaceId: z.string().optional(),
  framework: z.string().max(60).optional(),
  language: z.string().max(60).optional(),
  chatId: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: {
        workspace: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
        status: { not: "DELETED" },
      },
      select: {
        id: true, name: true, description: true, status: true, framework: true,
        language: true, visibility: true, workspaceId: true, updatedAt: true,
        _count: { select: { files: true, chats: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`projects:create:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new ApiError(429, `太频繁，请 ${rl.retryAfterSec}s 后重试`);

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效：项目名必填");
    const { name, description, workspaceId, framework, language, chatId } = parsed.data;

    // Workspace authorization.
    let wsId = workspaceId;
    if (wsId) {
      const ws = await prisma.workspace.findUnique({ where: { id: wsId } });
      if (!ws) throw new ApiError(404, "工作区不存在");
      if (ws.ownerId !== user.id) {
        const m = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: wsId, userId: user.id } },
        });
        if (!m || m.role === "VIEWER") throw new ApiError(403, "权限不足");
      }
    } else {
      const personal = await prisma.workspace.findFirst({
        where: { ownerId: user.id, isPersonal: true },
        select: { id: true },
      });
      if (!personal) throw new ApiError(500, "个人工作区缺失");
      wsId = personal.id;
    }

    const project = await prisma.project.create({
      data: { name: name.trim(), description, workspaceId: wsId, ownerId: user.id, framework, language },
    });

    // Optionally attach an existing chat to this project.
    if (chatId) {
      const chat = await prisma.chat.findUnique({ where: { id: chatId } });
      if (chat && chat.userId === user.id) {
        await prisma.chat.update({ where: { id: chatId }, data: { projectId: project.id } });
      }
    }

    return NextResponse.json({ projectId: project.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
