import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";

/** GET — recent file changes (new/modified/deleted/renamed) for the project. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id);

    const changes = await prisma.fileChange.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, path: true, kind: true, fromPath: true, agentRun: true, createdAt: true },
    });

    // Dedupe by path+kind keeping the newest.
    const seen = new Set<string>();
    const unique = changes.filter((c) => {
      const key = `${c.path}:${c.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return NextResponse.json({ changes: unique });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
