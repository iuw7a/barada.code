import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const CreateBody = z.object({ name: z.string().min(1).max(60) });

/** GET /api/workspaces — workspaces the user owns or is a member of. */
export async function GET() {
  try {
    const user = await requireUser();
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      select: { id: true, name: true, isPersonal: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ workspaces });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** POST /api/workspaces — create a workspace; creator becomes OWNER + member. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`workspaces:create:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too many requests, retry in ${rl.retryAfterSec}s`);

    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid workspace name");
    const name = parsed.data.name.trim();

    const workspace = await prisma.workspace.create({
      data: {
        name,
        ownerId: user.id,
        isPersonal: false,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
      select: { id: true, name: true, isPersonal: true },
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
