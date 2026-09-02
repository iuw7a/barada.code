import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { validateSubdomain, publicUrl } from "@/lib/projects/publish";
import { verifyProject } from "@/lib/sandbox/verify";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET — current deployment state + recent history for a project. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id);

    const deployment = await prisma.deployment.findUnique({
      where: { projectId: id },
      include: { history: { orderBy: { createdAt: "desc" }, take: 10 } },
    });
    if (!deployment) return NextResponse.json({ deployment: null, history: [] });
    const { history, ...dep } = deployment;
    return NextResponse.json({
      deployment: dep,
      history,
      url: publicUrl(dep.subdomain),
      cnameTarget: `${dep.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "iuw7a.com"}`,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const PublishBody = z.object({ subdomain: z.string().min(1).max(63) });

/**
 * POST — publish or redeploy with REAL verification.
 * Pipeline: verify (install → typecheck → build → boot → probe) → record
 * deployment history → flip the subdomain live. A deployment that fails
 * verification is recorded as FAILED and the subdomain is NOT updated.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = PublishBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Subdomain required");
    const check = validateSubdomain(parsed.data.subdomain);
    if (!check.ok) throw new ApiError(400, check.error);

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!project || project.status === "DELETED") throw new ApiError(404, "Project not found");

    // Subdomain uniqueness (excluding this project's own deployment).
    const taken = await prisma.deployment.findFirst({
      where: { subdomain: check.slug, NOT: { projectId: id } },
      select: { id: true },
    });
    if (taken) throw new ApiError(409, "This subdomain is already taken");

    // ── REAL VERIFICATION GATE ───────────────────────────────────────────
    const historyEntry = await prisma.deploymentHistory.create({
      data: { projectId: id, subdomain: check.slug, status: "VERIFYING", commitLabel: "publish" },
    });

    const report = await verifyProject(id);
    await prisma.deploymentHistory.update({
      where: { id: historyEntry.id },
      data: {
        status: report.ok ? "LIVE" : "FAILED",
        buildLog: report.steps
          .map((s) => `${s.ok ? "✓" : "✗"} ${s.name}${s.skipped ? " (skipped)" : ""} — ${s.detail.slice(0, 300)}`)
          .join("\n")
          .slice(0, 100_000),
        healthOk: report.ok,
      },
    });

    if (!report.ok) {
      throw new ApiError(422, `Publish blocked — verification failed: ${report.summary.slice(0, 500)}`);
    }

    const deployment = await prisma.deployment.upsert({
      where: { projectId: id },
      create: { projectId: id, subdomain: check.slug, status: "LIVE" },
      update: { subdomain: check.slug, status: "LIVE", lastDeployedAt: new Date() },
    });
    return NextResponse.json({ deployment, url: publicUrl(deployment.subdomain), verification: report.summary });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE — unpublish (keeps the record with subdomain reserved, site offline). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "ADMIN");

    const deployment = await prisma.deployment.findUnique({ where: { projectId: id } });
    if (!deployment) throw new ApiError(404, "Project is not published");
    await prisma.deployment.update({ where: { id: deployment.id }, data: { status: "OFFLINE" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
