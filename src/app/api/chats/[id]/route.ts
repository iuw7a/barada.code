import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

async function ownedChat(chatId: string, userId: string) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || chat.userId !== userId) throw new ApiError(404, "Chat not found");
  return chat;
}

/** GET /api/chats/[id] — chat metadata. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const chat = await ownedChat(id, user.id);
    return NextResponse.json({ chat: { id: chat.id, title: chat.title, status: chat.status, projectId: chat.projectId } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const PatchBody = z.object({ title: z.string().min(1).max(120) });

/** PATCH /api/chats/[id] — rename a conversation. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await ownedChat(id, user.id);
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid title");
    const chat = await prisma.chat.update({ where: { id }, data: { title: parsed.data.title } });
    return NextResponse.json({ chat: { id: chat.id, title: chat.title } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE /api/chats/[id] — delete a conversation and its messages. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await ownedChat(id, user.id);
    await prisma.chat.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
