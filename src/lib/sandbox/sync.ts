/**
 * File synchronization: durable DB rows (ProjectFile) ⇄ sandbox filesystem.
 *
 * The sandbox disk is the hot working environment (npm, builds, dev servers);
 * the database is the durable source of truth (preview, publish, checkpoints).
 * Every agent FS tool writes through to both sides in one call.
 */

import { prisma } from "@/lib/prisma";
import { getSandbox } from "./local";
import { normalizePath, parentDir } from "@/lib/projects/pathSafe";
import path from "node:path";
import { mkdir, readFile, rm, rename, writeFile, readdir, stat } from "node:fs/promises";

const IGNORED = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".cache",
  ".turbo", "coverage", "__pycache__", ".venv", "venv",
]);

function shouldIgnore(p: string): boolean {
  return p.split("/").some((seg) => IGNORED.has(seg));
}

/** Ensure parent dir rows exist in the DB. */
async function ensureDirRows(projectId: string, filePath: string) {
  const parent = parentDir(filePath);
  if (!parent) return;
  const segments = parent.split("/");
  let acc = "";
  for (const seg of segments) {
    acc = acc ? `${acc}/${seg}` : seg;
    await prisma.projectFile.upsert({
      where: { projectId_path: { projectId, path: acc } },
      create: { projectId, path: acc, isDir: true },
      update: {},
    });
  }
}

/** Write a file to BOTH the sandbox disk and the durable DB. Records the change. */
export async function syncedWrite(
  projectId: string,
  rawPath: string,
  content: string,
  agentRun?: string
): Promise<{ path: string; size: number }> {
  const p = normalizePath(rawPath);
  if (p.endsWith("/")) throw new Error("path must be a file");
  const ws = await getSandbox().ensureWorkspace(projectId);
  const abs = path.join(ws, p);
  if (!abs.startsWith(ws)) throw new Error("path escapes workspace");

  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf-8");
  await ensureDirRows(projectId, p);
  await prisma.projectFile.upsert({
    where: { projectId_path: { projectId, path: p } },
    create: { projectId, path: p, isDir: false, content, size: Buffer.byteLength(content) },
    update: { content, size: Buffer.byteLength(content), isDir: false },
  });
  await recordChange(projectId, p, "created", agentRun);
  return { path: p, size: Buffer.byteLength(content) };
}

/** Read a file: sandbox disk first, DB fallback (covers not-yet-synced state). */
export async function syncedRead(projectId: string, rawPath: string): Promise<string | null> {
  const p = normalizePath(rawPath);
  try {
    const ws = getSandbox().workspacePath(projectId);
    const abs = path.join(ws, p);
    if (abs.startsWith(ws)) return await readFile(abs, "utf-8");
  } catch {
    /* fall through to DB */
  }
  const row = await prisma.projectFile.findUnique({
    where: { projectId_path: { projectId, path: p } },
  });
  return row && !row.isDir ? row.content ?? "" : null;
}

/** Delete a file or subtree from BOTH sides. */
export async function syncedDelete(projectId: string, rawPath: string, agentRun?: string): Promise<number> {
  const p = normalizePath(rawPath);
  const ws = await getSandbox().ensureWorkspace(projectId);
  const abs = path.join(ws, p);
  if (!abs.startsWith(ws)) throw new Error("path escapes workspace");

  let n = 0;
  try {
    const st = await stat(abs);
    if (st.isDirectory()) {
      const all = await prisma.projectFile.findMany({
        where: { projectId, OR: [{ path: p }, { path: { startsWith: p + "/" } }] },
        select: { id: true },
      });
      n = all.length;
      await prisma.projectFile.deleteMany({ where: { projectId, OR: [{ path: p }, { path: { startsWith: p + "/" } }] } });
      await rm(abs, { recursive: true, force: true });
    } else {
      n = 1;
      await prisma.projectFile.deleteMany({ where: { projectId, path: p } });
      await rm(abs, { force: true });
    }
  } catch {
    // disk miss — still clean the DB
    const res = await prisma.projectFile.deleteMany({
      where: { projectId, OR: [{ path: p }, { path: { startsWith: p + "/" } }] },
    });
    n = res.count;
  }
  await recordChange(projectId, p, "deleted", agentRun);
  return n;
}

/** Rename/move a file or folder in BOTH sides (updates DB subtree paths). */
export async function syncedRename(projectId: string, rawFrom: string, rawTo: string, agentRun?: string): Promise<number> {
  const from = normalizePath(rawFrom);
  const to = normalizePath(rawTo);
  if (to.startsWith(from + "/")) throw new Error("cannot move a folder into itself");
  const ws = await getSandbox().ensureWorkspace(projectId);
  const absFrom = path.join(ws, from);
  const absTo = path.join(ws, to);
  if (!absFrom.startsWith(ws) || !absTo.startsWith(ws)) throw new Error("path escapes workspace");

  const entries = await prisma.projectFile.findMany({
    where: { projectId, OR: [{ path: from }, { path: { startsWith: from + "/" } }] },
  });
  if (entries.length === 0) throw new Error(`not found: ${from}`);

  await mkdir(path.dirname(absTo), { recursive: true });
  try {
    await rename(absFrom, absTo);
  } catch {
    /* disk miss — DB-only move still proceeds */
  }
  for (const entry of entries) {
    const newPath = entry.path === from ? to : to + entry.path.slice(from.length);
    await prisma.projectFile.update({
      where: { projectId_path: { projectId, path: entry.path } },
      data: { path: newPath },
    });
  }
  await recordChange(projectId, to, "renamed", agentRun, from);
  return entries.length;
}

/** Create a directory on both sides. */
export async function syncedMkdir(projectId: string, rawPath: string): Promise<string> {
  const p = normalizePath(rawPath);
  const ws = await getSandbox().ensureWorkspace(projectId);
  const abs = path.join(ws, p);
  if (!abs.startsWith(ws)) throw new Error("path escapes workspace");
  await mkdir(abs, { recursive: true });
  await ensureDirRows(projectId, p + "/placeholder"); // creates all segment rows
  await prisma.projectFile.upsert({
    where: { projectId_path: { projectId, path: p } },
    create: { projectId, path: p, isDir: true },
    update: { isDir: true },
  });
  return p;
}

/** List files (DB view — includes both synced and DB-only entries). */
export async function listFilesMeta(projectId: string) {
  return prisma.projectFile.findMany({
    where: { projectId },
    select: { path: true, isDir: true, size: true, updatedAt: true },
    orderBy: { path: "asc" },
  });
}

/**
 * Hydrate: push durable DB files into a (fresh) sandbox workspace.
 * Called when a workspace dir is empty but the project has files.
 */
export async function hydrateWorkspace(projectId: string): Promise<number> {
  const ws = await getSandbox().ensureWorkspace(projectId);
  const existing = await readdir(ws).catch(() => [] as string[]);
  const meaningful = existing.filter((e) => !IGNORED.has(e));
  const files = await prisma.projectFile.findMany({
    where: { projectId, isDir: false },
    select: { path: true, content: true },
  });
  if (meaningful.length > 0) return 0; // disk already has content — don't clobber
  for (const f of files) {
    const abs = path.join(ws, f.path);
    if (!abs.startsWith(ws)) continue;
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, f.content ?? "", "utf-8");
  }
  return files.length;
}

/**
 * Pull node_modules-free file trees from disk back into the DB (e.g. after
 * scaffolding or git checkout inside the sandbox). Skips heavy/ignored dirs
 * and binary-ish files.
 */
export async function pullFromDisk(
  projectId: string,
  agentRun?: string,
  opts?: { maxFiles?: number; maxFileBytes?: number }
): Promise<number> {
  const ws = getSandbox().workspacePath(projectId);
  const maxFiles = opts?.maxFiles ?? 500;
  const maxBytes = opts?.maxFileBytes ?? 1_000_000;
  let written = 0;

  async function walk(dir: string, rel: string): Promise<void> {
    if (written >= maxFiles) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (written >= maxFiles) return;
      if (IGNORED.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await ensureDirRows(projectId, relPath + "/placeholder");
        await prisma.projectFile.upsert({
          where: { projectId_path: { projectId, path: relPath } },
          create: { projectId, path: relPath, isDir: true },
          update: {},
        });
        await walk(abs, relPath);
      } else {
        const st = await stat(abs).catch(() => null);
        if (!st || st.size > maxBytes) continue;
        const content = await readFile(abs, "utf-8").catch(() => null);
        if (content === null) continue; // binary — skip
        await prisma.projectFile.upsert({
          where: { projectId_path: { projectId, path: relPath } },
          create: { projectId, path: relPath, isDir: false, content, size: st.size },
          update: { content, size: st.size, isDir: false },
        });
        await recordChange(projectId, relPath, "created", agentRun);
        written++;
      }
    }
  }

  await walk(ws, "");
  return written;
}

async function recordChange(projectId: string, p: string, kind: string, agentRun?: string, fromPath?: string) {
  // Suppress change tracking for dependency/build artifacts.
  if (shouldIgnore(p)) return;
  try {
    await prisma.fileChange.create({
      data: { projectId, path: p, kind, fromPath, agentRun },
    });
  } catch {
    /* change log is best-effort */
  }
}

/** Search file contents across the DB rows (fast enough for code-sized projects). */
export async function searchInProject(projectId: string, query: string, limit = 40): Promise<string[]> {
  const rows = await prisma.projectFile.findMany({
    where: { projectId, isDir: false },
    select: { path: true, content: true },
  });
  const needle = query.toLowerCase();
  const hits: string[] = [];
  for (const f of rows) {
    const lines = (f.content ?? "").split("\n");
    lines.forEach((line, i) => {
      if (hits.length < limit && line.toLowerCase().includes(needle)) {
        hits.push(`${f.path}:${i + 1}: ${line.trim().slice(0, 160)}`);
      }
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
