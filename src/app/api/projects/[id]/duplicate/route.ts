import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { requireProjectAccess } from "@/lib/permissions";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const access = await requireProjectAccess(user.id, id, "MEMBER");

    const source = await prisma.project.findUnique({
      where: { id },
      include: { files: true },
    });
    if (!source) throw new ApiError(404, "项目不存在");

    const copy = await prisma.project.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        workspaceId: source.workspaceId,
        ownerId: user.id,
        framework: source.framework,
        language: source.language,
        files: {
          create: source.files.map((f) => ({
            path: f.path,
            isDir: f.isDir,
            content: f.content,
            size: f.size,
          })),
        },
      },
    });
    void access;
    return NextResponse.json({ projectId: copy.id }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
