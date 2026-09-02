/**
 * Project checkpoints — snapshot & restore of durable project files.
 * Used before major agent operations so failed builds can roll back.
 */

import { prisma } from "@/lib/prisma";
import { syncedDelete, syncedWrite } from "./sync";
import { hydrateWorkspace } from "./sync";

export async function createCheckpoint(projectId: string, label: string): Promise<{ id: string; fileCount: number }> {
  const files = await prisma.projectFile.findMany({
    where: { projectId, isDir: false },
    select: { path: true, content: true },
  });
  const cp = await prisma.checkpoint.create({
    data: {
      projectId,
      label: label.slice(0, 120),
      fileCount: files.length,
      payload: files.map((f) => ({ path: f.path, content: f.content ?? "" })),
    },
  });
  return { id: cp.id, fileCount: files.length };
}

export async function listCheckpoints(projectId: string, take = 20) {
  return prisma.checkpoint.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, label: true, fileCount: true, createdAt: true },
  });
}

/**
 * Restore a checkpoint: replaces the durable file set with the snapshot,
 * mirrors the change onto the sandbox disk, and re-hydrates.
 */
export async function restoreCheckpoint(projectId: string, checkpointId: string): Promise<{ restored: number }> {
  const cp = await prisma.checkpoint.findUnique({ where: { id: checkpointId } });
  if (!cp || cp.projectId !== projectId) throw new Error("checkpoint not found");

  const snapshot = (cp.payload as Array<{ path: string; content: string }>) ?? [];

  // Wipe current file rows + disk (except nothing — full restore).
  const current = await prisma.projectFile.findMany({ where: { projectId }, select: { path: true, isDir: true } });
  for (const f of current) {
    await syncedDelete(projectId, f.path).catch(() => {});
  }
  for (const f of snapshot) {
    await syncedWrite(projectId, f.path, f.content).catch(() => {});
  }
  await hydrateWorkspace(projectId).catch(() => {});
  await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  return { restored: snapshot.length };
}

/** Keep checkpoint storage bounded: delete the oldest beyond N per project. */
export async function pruneCheckpoints(projectId: string, keep = 10): Promise<void> {
  const all = await prisma.checkpoint.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const stale = all.slice(keep);
  if (stale.length) {
    await prisma.checkpoint.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
}
