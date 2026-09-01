import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效");
    await prisma.user.update({
      where: { id: user.id },
      data: parsed.data,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const PasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = PasswordBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "新密码至少 8 位");

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    if (!row || !verifyPassword(parsed.data.currentPassword, row.passwordHash)) {
      throw new ApiError(403, "当前密码错误");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(parsed.data.newPassword) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
