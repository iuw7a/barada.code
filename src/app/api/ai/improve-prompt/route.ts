import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";
import { getProvider, getModel } from "@/lib/ai/provider";

const Body = z.object({ prompt: z.string().min(3).max(4000) });

const SYSTEM = `You are a prompt engineer for Barada Code, an AI app builder.
Rewrite the user's rough idea into ONE clear, detailed build prompt.
Include: app type, sections/pages, design style, colors (only if the user gave any),
responsive behavior, and key features. Keep the user's language (Arabic stays Arabic,
English stays English, etc.). Output ONLY the improved prompt — no preamble, no quotes,
no explanations. Maximum ~180 words.`;

/**
 * POST /api/ai/improve-prompt
 * Rewrites a rough idea into a detailed build prompt using the configured
 * AI provider (same provider as the agent — no mock responses).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`improve:${user.id}`, 12, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too frequent — retry in ${rl.retryAfterSec}s`);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid prompt");

    const provider = getProvider();
    const model = getModel();
    let improved = "";
    for await (const ev of provider.streamChat({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: parsed.data.prompt },
      ],
    })) {
      if (ev.type === "delta") improved += ev.text;
    }

    improved = improved.trim().replace(/^["“](.*)["”]$/s, "$1").trim();
    if (!improved) throw new ApiError(502, "AI returned an empty prompt");
    return NextResponse.json({ improved });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
