import { NextResponse } from "next/server";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://agents.assemblyai.com/v1/token";

/**
 * POST /api/voice/token
 * Mints a short-lived, single-use Voice Agent session token.
 * The AssemblyAI API key never leaves the server.
 *
 * expires_in_seconds (1–600): window to OPEN the websocket.
 * max_session_duration_seconds (60–10800): cap on the session itself.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const rl = rateLimit(`voice:token:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too many requests, retry in ${rl.retryAfterSec}s`);

    const key = process.env.ASSEMBLYAI_API_KEY;
    if (!key) throw new ApiError(503, "Voice is not configured (missing ASSEMBLYAI_API_KEY)");

    const url = new URL(TOKEN_URL);
    url.searchParams.set("expires_in_seconds", "120");
    url.searchParams.set("max_session_duration_seconds", "1800");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[voice] token mint failed ${res.status}:`, body.slice(0, 300));
      throw new ApiError(502, "Voice provider rejected the session request");
    }
    const { token } = (await res.json()) as { token: string };
    return NextResponse.json({ token });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
