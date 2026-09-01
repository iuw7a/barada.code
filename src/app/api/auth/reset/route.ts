import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

const RequestBody = z.object({ email: z.string().email().max(200) });
const ConfirmBody = z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(200) });

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * POST /api/auth/reset
 *  - { email }              → create reset token (email delivery is a TODO;
 *                             dev returns the token so the flow is testable)
 *  - { token, password }    → consume token, set new password
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = rateLimit(`reset:${ip}`, 5, 60_000);
    if (!rl.ok) throw new ApiError(429, `太多请求，请 ${rl.retryAfterSec}s 后重试`);

    const raw = await req.json().catch(() => null);

    if (raw && typeof raw === "object" && "token" in raw) {
      const parsed = ConfirmBody.safeParse(raw);
      if (!parsed.success) throw new ApiError(400, "输入无效");
      const { token, password } = parsed.data;

      const reset = await prisma.passwordReset.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
        throw new ApiError(400, "重置链接无效或已过期");
      }
      await prisma.$transaction([
        prisma.user.update({
          where: { id: reset.userId },
          data: { passwordHash: hashPassword(password) },
        }),
        prisma.passwordReset.update({
          where: { id: reset.id },
          data: { usedAt: new Date() },
        }),
        // Invalidate all sessions — password change forces re-login everywhere.
        prisma.session.deleteMany({ where: { userId: reset.userId } }),
      ]);
      return NextResponse.json({ ok: true });
    }

    const parsed = RequestBody.safeParse(raw);
    if (!parsed.success) throw new ApiError(400, "输入无效");
    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Always return ok — do not leak which emails exist.
    if (!user) return NextResponse.json({ ok: true });

    const token = randomBytes(32).toString("hex");
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    // Send the reset link from the security sender (ai@iuw7a.com).
    const { renderTemplate, sendEmail } = await import("@/lib/email");
    const tpl = renderTemplate("password_reset", {
      name: user.name,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/reset?token=${token}`,
    });
    sendEmail({ template: "password_reset", to: user.email, subject: tpl.subject, html: tpl.html }).catch(() => {});

    const devEcho = process.env.NODE_ENV !== "production" ? { devToken: token } : {};
    return NextResponse.json({ ok: true, ...devEcho });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
