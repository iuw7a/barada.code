import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const Brief = z.object({
  siteType: z.string().min(1).max(500),
  name: z.string().max(120).optional(),
  style: z.string().max(500).optional(),
  colors: z.string().max(300).optional(),
  pages: z.array(z.string().max(100)).max(20).optional(),
  features: z.array(z.string().max(200)).max(20).optional(),
  language: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/chats/[id]/voice-brief
 * Called by the browser when the voice agent's `submit_project_brief` tool
 * fires after the user confirmed. Composes the builder prompt from the
 * structured brief, stores it as a USER message in THIS chat, and marks the
 * chat GENERATING — the client then runs the existing /stream agent.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: chatId } = await params;
    const rl = rateLimit(`voice:brief:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too many requests, retry in ${rl.retryAfterSec}s`);

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new ApiError(404, "Chat not found");
    if (chat.userId !== user.id) throw new ApiError(403, "No access to this chat");

    const parsed = Brief.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid brief");
    const b = parsed.data;

    const lines = [
      `Build a ${b.siteType}${b.name ? ` called "${b.name}"` : ""}.`,
      b.style && `Visual style: ${b.style}.`,
      b.colors && `Colors: ${b.colors}.`,
      b.pages?.length && `Pages/sections: ${b.pages.join(", ")}.`,
      b.features?.length && `Features: ${b.features.join(", ")}.`,
      b.language && `All website content must be in language code: ${b.language}.`,
      b.notes && `Additional requirements: ${b.notes}`,
      "The website must be clean, professional and responsive.",
      "(Requirements collected through a voice conversation — the user has confirmed them.)",
    ].filter(Boolean);
    const prompt = lines.join(" ");

    const message = await prisma.message.create({
      data: { chatId, userId: user.id, role: "USER", content: prompt, status: "DONE" },
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
