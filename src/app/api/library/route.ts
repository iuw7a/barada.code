import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

const STORAGE_ROOT = process.env.STORAGE_ROOT ?? "./.storage";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET() {
  try {
    const user = await requireUser();
    const assets = await prisma.asset.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, kind: true, size: true, meta: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ assets });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const UploadBody = z.object({
  name: z.string().min(1).max(200),
  kind: z.enum(["IMAGE", "DOC", "TEMPLATE", "COMPONENT", "OTHER"]).default("OTHER"),
  dataBase64: z.string().max(Math.ceil(MAX_SIZE * 4 / 3) + 1000),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`library:${user.id}`, 20, 60_000);
    if (!rl.ok) throw new ApiError(429, `太频繁，请 ${rl.retryAfterSec}s 后重试`);

    const parsed = UploadBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效或文件过大（≤10MB）");
    const { name, kind, dataBase64 } = parsed.data;

    const buffer = Buffer.from(dataBase64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_SIZE) throw new ApiError(400, "文件大小无效");

    // Storage key is server-generated — user input never touches the filesystem path.
    const storageKey = `${user.id}/${Date.now()}-${randomBytes(6).toString("hex")}${path.extname(name).slice(0, 20)}`;
    const abs = path.join(STORAGE_ROOT, storageKey);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, buffer);

    const asset = await prisma.asset.create({
      data: {
        userId: user.id,
        name: name.slice(0, 200),
        kind,
        storageKey,
        size: buffer.length,
      },
    });
    return NextResponse.json({ assetId: asset.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const DeleteBody = z.object({ assetId: z.string() });

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const parsed = DeleteBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");

    const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId } });
    if (!asset || asset.userId !== user.id) throw new ApiError(404, "资源不存在");

    await unlink(path.join(STORAGE_ROOT, asset.storageKey)).catch(() => {});
    await prisma.asset.delete({ where: { id: asset.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
