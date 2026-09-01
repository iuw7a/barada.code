import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

const Body = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = rateLimit(`signup:${ip}`, 5, 60_000);
    if (!rl.ok) throw new ApiError(429, `太多请求，请 ${rl.retryAfterSec}s 后重试`);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "输入无效：姓名、邮箱和 8+ 位密码必填");
    const { name, email, password } = parsed.data;

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new ApiError(409, "该邮箱已注册");

    // Create user first, then personal workspace — in one transaction.
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          settings: { create: {} },
          subscriptions: { create: { plan: "FREE" } },
        },
      });
      await tx.workspace.create({
        data: {
          name: "Personal Workspace",
          isPersonal: true,
          ownerId: u.id,
          members: { create: { userId: u.id, role: "OWNER" } },
        },
      });
      return u;
    });

    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
