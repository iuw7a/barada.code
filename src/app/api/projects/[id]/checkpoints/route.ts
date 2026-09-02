import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from "@/lib/sandbox/checkpoints";

/** GET — list checkpoints for the project. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id);
    const checkpoints = await listCheckpoints(id);
    return NextResponse.json({ checkpoints });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const CreateBody = z.object({ label: z.string().min(1).max(120) });

/** POST — create a checkpoint. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "label required");
    const cp = await createCheckpoint(id, parsed.data.label);
    return NextResponse.json({ checkpoint: cp }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const RestoreBody = z.object({ checkpointId: z.string().min(1) });

/** PUT — restore a checkpoint. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");
    const parsed = RestoreBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "checkpointId required");
    const result = await restoreCheckpoint(id, parsed.data.checkpointId);
    return NextResponse.json({ ok: true, restored: result.restored });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
