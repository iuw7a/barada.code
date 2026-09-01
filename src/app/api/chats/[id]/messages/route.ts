import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";

const PostBody = z.object({ content: z.string().min(1).max(8000) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: chatId } = await params;
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, "对话不存在");
    if (chat.userId !== user.id) throw new ApiError(403, "无权访问该对话");

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, status: true, toolCalls: true, createdAt: true },
    });
    return NextResponse.json({ messages });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: chatId } = await params;
    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, "对话不存在");
    if (chat.userId !== user.id) throw new ApiError(403, "无权访问该对话");

    const parsed = PostBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");

    const message = await prisma.message.create({
      data: { chatId, userId: user.id, role: "USER", content: parsed.data.content, status: "DONE" },
    });
    await prisma.chat.update({
      where: { id: chatId },
      data: { status: "GENERATING", updatedAt: new Date() },
    });
    return NextResponse.json({ messageId: message.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
