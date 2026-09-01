import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";
import { normalizePath } from "@/lib/projects/pathSafe";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id);

    const url = new URL(req.url);
    const path = url.searchParams.get("path");

    if (path) {
      // Read one file.
      let norm: string;
      try {
        norm = normalizePath(path);
      } catch (e) {
        throw new ApiError(400, e instanceof Error ? e.message : "非法路径");
      }
      const file = await prisma.projectFile.findUnique({
        where: { projectId_path: { projectId: id, path: norm } },
      });
      if (!file) throw new ApiError(404, "文件不存在");
      return NextResponse.json({ file: { path: file.path, isDir: file.isDir, content: file.content, size: file.size } });
    }

    // Full tree.
    const files = await prisma.projectFile.findMany({
      where: { projectId: id },
      select: { path: true, isDir: true, size: true, updatedAt: true },
      orderBy: { path: "asc" },
    });
    return NextResponse.json({ files });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const WriteBody = z.object({
  path: z.string().min(1),
  content: z.string().max(2_000_000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = WriteBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");
    let path: string;
    try {
      path = normalizePath(parsed.data.path);
    } catch (e) {
      throw new ApiError(400, e instanceof Error ? e.message : "非法路径");
    }

    const isDir = path.endsWith("/") || parsed.data.content === undefined;
    const content = isDir ? null : parsed.data.content ?? "";
    const cleanPath = isDir ? path.replace(/\/+$/, "") : path;
    if (!cleanPath) throw new ApiError(400, "路径为空");

    const file = await prisma.projectFile.upsert({
      where: { projectId_path: { projectId: id, path: cleanPath } },
      create: { projectId: id, path: cleanPath, isDir, content, size: content ? Buffer.byteLength(content) : 0 },
      update: { content, size: content ? Buffer.byteLength(content) : 0 },
    });
    await prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ file: { path: file.path, isDir: file.isDir } }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const DeleteBody = z.object({ path: z.string().min(1) });

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");
    let path: string;
    try {
      path = normalizePath(parsed.data.path);
    } catch (e) {
      throw new ApiError(400, e instanceof Error ? e.message : "非法路径");
    }

    const deleted = await prisma.projectFile.deleteMany({
      where: { projectId: id, OR: [{ path }, { path: { startsWith: path + "/" } }] },
    });
    if (deleted.count === 0) throw new ApiError(404, "文件不存在");
    return NextResponse.json({ ok: true, deleted: deleted.count });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const RenameBody = z.object({ from: z.string().min(1), to: z.string().min(1) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireProjectAccess(user.id, id, "MEMBER");

    const parsed = RenameBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");
    let from: string, to: string;
    try {
      from = normalizePath(parsed.data.from);
      to = normalizePath(parsed.data.to);
    } catch (e) {
      throw new ApiError(400, e instanceof Error ? e.message : "非法路径");
    }
    if (to.startsWith(from + "/")) throw new ApiError(400, "不能移动到自身内部");

    const entries = await prisma.projectFile.findMany({
      where: { projectId: id, OR: [{ path: from }, { path: { startsWith: from + "/" } }] },
    });
    if (entries.length === 0) throw new ApiError(404, "文件不存在");

    for (const entry of entries) {
      const newPath = entry.path === from ? to : to + entry.path.slice(from.length);
      try {
        await prisma.projectFile.update({
          where: { projectId_path: { projectId: id, path: entry.path } },
          data: { path: newPath },
        });
      } catch {
        throw new ApiError(409, `目标已存在: ${newPath}`);
      }
    }
    return NextResponse.json({ ok: true, moved: entries.length });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
