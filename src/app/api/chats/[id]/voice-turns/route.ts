import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const Body = z.object({
  role: z.enum(["USER", "ASSISTANT"]),
  content: z.string().min(1).max(4000),
});

/**
 * POST /api/chats/[id]/voice-turns
 * Persists one finalized voice turn as a normal chat message so voice and
 * text share the same conversation history. Chat status is left untouched —
 * voice turns are conversational and never trigger generation by themselves.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: chatId } = await params;
    const rl = rateLimit(`voice:turn:${user.id}`, 120, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too many requests, retry in ${rl.retryAfterSec}s`);

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, "Chat not found");
    if (chat.userId !== user.id) throw new ApiError(403, "No access to this chat");

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid turn");
    const { role, content } = parsed.data;

    const message = await prisma.message.create({
      data: { chatId, userId: user.id, role, content, status: "DONE" },
      select: { id: true },
    });
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ messageId: message.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
