import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/search?q= — global search for the ⌘K menu. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ users: [], projects: [] });

    const [users, projects] = await Promise.all([
      prisma.user.findMany({
        where: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
        take: 5,
        select: { id: true, name: true, email: true },
      }),
      prisma.project.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        take: 5,
        select: { id: true, name: true },
      }),
    ]);
    return NextResponse.json({ users, projects });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
