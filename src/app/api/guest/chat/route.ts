import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";
import { getProvider, getModel, type ChatMessage } from "@/lib/ai/provider";
import { getSetting } from "@/lib/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(6)
    .optional(),
});

const SYSTEM = [
  "You are Barada, an AI app builder. The user is trying the product as a guest (not signed in).",
  "Answer their question about what they want to build, in the language they write in.",
  "Be helpful and concrete. If they describe an app idea, briefly sketch what you could build for them",
  "(pages, features, style) and mention that signing in lets Barada actually build the full project.",
  "Keep replies under 180 words.",
].join(" ");

/**
 * POST /api/guest/chat — one free AI exchange for signed-out visitors.
 * No persistence, no tools, strict per-IP limit. After the free quota the
 * client is expected to ask the user to sign in.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const limits = await getSetting("guestLimits", { perHourPerIp: 3 });
    const rl = rateLimit(`guest:${ip}`, limits.perHourPerIp, 60 * 60 * 1000); // admin-configurable
    if (!rl.ok) throw new ApiError(429, "Free limit reached — sign in to keep building.");

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    const { message, history } = parsed.data;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM },
      ...(history ?? []).map((h) => ({ role: h.role, content: h.content }) as ChatMessage),
      { role: "user", content: message },
    ];

    let reply = "";
    for await (const chunk of getProvider().streamChat({ model: getModel(), messages })) {
      if (chunk.type === "delta") reply += chunk.text;
    }

    return NextResponse.json({ reply: reply.trim() });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
