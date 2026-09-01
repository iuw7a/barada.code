import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin, audit, setSetting } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const Body = z.object({ perHourPerIp: z.number().int().min(0).max(1000) });

export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    const data = Body.parse(await req.json().catch(() => null));
    await setSetting("guestLimits", data);
    await audit(admin.id, "ai.settings_changed", "guestLimits", data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
