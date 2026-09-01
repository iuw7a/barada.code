import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

const CreateBody = z.object({
  firstMessage: z.string().min(1).max(8000).optional(),
  workspaceId: z.string().optional(),
  title: z.string().max(120).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const chats = await prisma.chat.findMany({
      where: { userId: user.id },
      select: { id: true, title: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ chats });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`chats:create:${user.id}`, 20, 60_000);
    if (!rl.ok) throw new ApiError(429, `太频繁，请 ${rl.retryAfterSec}s 后重试`);

    const parsed = CreateBody.safeParse((await req.json().catch(() => ({}))) ?? {});
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    const { firstMessage, workspaceId, title } = parsed.data;

    // Resolve workspace: explicit → user's personal.
    let wsId = workspaceId;
    if (wsId) {
      const ws = await prisma.workspace.findUnique({ where: { id: wsId } });
      if (!ws) throw new ApiError(404, "工作区不存在");
      if (ws.ownerId !== user.id) {
        const m = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: wsId, userId: user.id } },
        });
        if (!m) throw new ApiError(403, "无权访问该工作区");
      }
    } else {
      let personal = await prisma.workspace.findFirst({
        where: { ownerId: user.id, isPersonal: true },
        select: { id: true },
      });
      // Self-healing: accounts created outside the signup flow (e.g. admins)
      // get their personal workspace created on first use.
      if (!personal) {
        const ws = await prisma.workspace.create({
          data: { name: "Personal Workspace", isPersonal: true, ownerId: user.id },
          select: { id: true },
        });
        await prisma.workspaceMember.create({
          data: { workspaceId: ws.id, userId: user.id, role: "OWNER" },
        });
        personal = ws;
      }
      wsId = personal.id;
    }

    const derivedTitle = title ?? (firstMessage ? firstMessage.slice(0, 60) : "New chat");

    const chat = await prisma.chat.create({
      data: {
        title: derivedTitle,
        userId: user.id,
        workspaceId: wsId,
        status: firstMessage ? "GENERATING" : "IDLE",
        messages: firstMessage
          ? {
              create: {
                userId: user.id,
                role: "USER",
                content: firstMessage,
                status: "DONE",
              },
            }
          : undefined,
      },
      include: { messages: true },
    });

    return NextResponse.json({ chatId: chat.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
