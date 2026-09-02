import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { getSandbox } from "@/lib/sandbox/local";
import { pickPort } from "@/lib/sandbox/verify";

/** GET — list live sandbox processes for this project (UI status). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id);

    const procs = getSandbox().listProcesses(id);
    return NextResponse.json({
      processes: procs.map((p) => ({
        id: p.id,
        command: p.command,
        status: p.status,
        port: p.port ?? null,
        pid: p.pid ?? null,
        startedAt: p.startedAt,
        tail: p.tail.slice(-1200),
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const StartBody = z.object({
  command: z.string().min(1).max(2000),
  name: z.string().max(40).optional(),
  port: z.number().int().min(1024).max(65535).optional(),
});

/** POST — start a long-running process (dev server). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = StartBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid command");

    const sandbox = getSandbox();
    const port = parsed.data.port ?? pickPort();
    const info = await sandbox.startProcess(id, parsed.data.command, {
      name: parsed.data.name ?? "dev",
      onPort: port,
      env: { PORT: String(port) },
    });
    await prisma.projectProcess
      .create({
        data: {
          projectId: id,
          name: parsed.data.name ?? "dev",
          command: info.command,
          status: "RUNNING",
          port,
          pid: info.pid,
          startedBy: user.id,
        },
      })
      .catch(() => {});

    return NextResponse.json({ process: { id: info.id, status: info.status, port, command: info.command } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const StopBody = z.object({ processId: z.string().min(1) });

/** DELETE — stop a process. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = StopBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "processId required");

    const stopped = await getSandbox().stopProcess(id, parsed.data.processId);
    await prisma.projectProcess.updateMany({
      where: { projectId: id, status: "RUNNING" },
      data: { status: "STOPPED", endedAt: new Date() },
    }).catch(() => {});
    return NextResponse.json({ ok: stopped });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
