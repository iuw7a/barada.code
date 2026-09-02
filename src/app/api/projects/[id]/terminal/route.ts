import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { getSandbox } from "@/lib/sandbox/local";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 300;

/** GET — recent terminal log entries for this project. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id);

    const logs = await prisma.terminalLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, command: true, output: true, exitCode: true, kind: true, createdAt: true },
    });
    return NextResponse.json({ logs });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const ExecBody = z.object({
  command: z.string().min(1).max(4000),
  timeoutSec: z.number().min(1).max(600).optional(),
});

/** POST — execute a command in the project sandbox (user-driven terminal). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const rl = rateLimit(`terminal:${user.id}`, 20, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too frequent — retry in ${rl.retryAfterSec}s`);

    const parsed = ExecBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid command");

    const sandbox = getSandbox();
    const result = await sandbox.exec(id, parsed.data.command, {
      timeoutMs: Math.min((parsed.data.timeoutSec ?? 120) * 1000, 600_000),
    });

    const header = `exit ${result.exitCode}${result.timedOut ? " (TIMEOUT)" : ""} · ${result.durationMs}ms`;
    const output = `${header}\n${[result.stdout && `stdout:\n${result.stdout}`, result.stderr && `stderr:\n${result.stderr}`].filter(Boolean).join("\n")}`;

    await prisma.terminalLog
      .create({
        data: {
          projectId: id,
          command: parsed.data.command,
          output: output.slice(0, 100_000),
          exitCode: result.exitCode,
          kind: "exec",
        },
      })
      .catch(() => {});

    return NextResponse.json({
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
      stdout: result.stdout,
      stderr: result.stderr,
      header,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
