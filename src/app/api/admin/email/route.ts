import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/email — delivery stats + recent log entries. */
export async function GET() {
  try {
    await requireAdmin();
    const [total, sent, failed, recent] = await Promise.all([
      prisma.emailLog.count(),
      prisma.emailLog.count({ where: { status: "SENT" } }),
      prisma.emailLog.count({ where: { status: "FAILED" } }),
      prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return NextResponse.json({ stats: { total, sent, failed }, recent });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
