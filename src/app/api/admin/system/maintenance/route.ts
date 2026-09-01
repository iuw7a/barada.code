import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin, audit, setSetting } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const Body = z.object({ enabled: z.boolean(), message: z.string().max(300).optional() });

/** POST /api/admin/system/maintenance — SUPER_ADMIN only, audited. */
export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    await setSetting("maintenance", { enabled: parsed.data.enabled, message: parsed.data.message ?? "" });
    await audit(admin.id, parsed.data.enabled ? "maintenance.enabled" : "maintenance.disabled");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
