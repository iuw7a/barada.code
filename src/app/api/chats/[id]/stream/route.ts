import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";
import { runAgent } from "@/lib/ai/agent";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: chatId } = await params;

    const rl = rateLimit(`stream:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new ApiError(429, `太频繁，请 ${rl.retryAfterSec}s 后重试`);

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, "对话不存在");
    if (chat.userId !== user.id) throw new ApiError(403, "无权访问该对话");

    const lastUser = await prisma.message.findFirst({
      where: { chatId, role: "USER" },
      orderBy: { createdAt: "desc" },
    });
    if (!lastUser) throw new ApiError(400, "没有待处理的用户消息");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        try {
          for await (const ev of runAgent({ chatId, userId: user.id, projectId: chat.projectId })) {
            send(ev);
          }
        } catch (err) {
          send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
