import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/projects?q=&page=1 — searchable, paginated project list with owners. */
export async function GET(req: Request) {
  try {
    await requirePerm("projects.view");
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = 25;
    const where = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { owner: { email: { contains: q, mode: "insensitive" as const } } }, { owner: { name: { contains: q, mode: "insensitive" as const } } }] }
      : {};
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, status: true, framework: true, createdAt: true, updatedAt: true,
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { files: true, chats: true, aiJobs: true } },
        },
      }),
      prisma.project.count({ where }),
    ]);
    return NextResponse.json({ projects, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
