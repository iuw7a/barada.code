import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, audit } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const Body = z.object({ env: z.string().max(60) });

/** POST — live connection test per provider. Secrets stay server-side. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { env } = Body.parse(await req.json().catch(() => null));
    let ok = false;
    let error: string | undefined;

    if (env === "AI_API_KEY") {
      try {
        const res = await fetch(`${process.env.AI_BASE_URL ?? "https://api.openai.com/v1"}/models`, {
          headers: { Authorization: `Bearer ${process.env.AI_API_KEY ?? ""}` },
        });
        ok = res.ok;
        if (!ok) error = `provider returned ${res.status}`;
      } catch (e) { error = "unreachable"; }
    } else if (env === "ASSEMBLYAI_API_KEY") {
      try {
        const res = await fetch("https://agents.assemblyai.com/v1/token?expires_in_seconds=60", {
          headers: { Authorization: `Bearer ${process.env.ASSEMBLYAI_API_KEY ?? ""}` },
        });
        ok = res.ok;
        if (!ok) error = `provider returned ${res.status}`;
      } catch { error = "unreachable"; }
    } else if (env === "SUPABASE_SECRET_KEY") {
      ok = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
      if (!ok) error = "URL or key missing";
    } else if (env === "DATABASE_URL") {
      try { await prisma.$queryRaw`SELECT 1`; ok = true; } catch { error = "query failed"; }
    } else {
      throw new ApiError(400, "Unknown provider");
    }

    await audit(admin.id, "apikey.test", env, { ok });
    return NextResponse.json({ ok, error });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
