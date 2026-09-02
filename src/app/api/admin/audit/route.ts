import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/audit?page=1 — paginated audit trail with the acting admin's name. */
export async function GET(req: Request) {
  try {
    await requirePerm("audit.view");
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = 50;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id, action: l.action, target: l.target, meta: l.meta, createdAt: l.createdAt,
        admin: l.user ? { name: l.user.name, email: l.user.email } : null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
