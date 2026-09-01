import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rateLimit";

const Body = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    const rl = rateLimit(`signin:${ip}`, 20, 60_000);
    if (!rl.ok) throw new ApiError(429, `Too many attempts — try again in ${rl.retryAfterSec}s`);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "Wrong email or password");
    }
    if (user.banned) {
      throw new ApiError(403, "This account has been suspended. Contact support.");
    }

    await createSession(user.id);
    const role = user.role === "ADMIN" || user.role === "SUPER_ADMIN" || user.isAdmin ? (user.role === "USER" ? "ADMIN" : user.role) : "USER";
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
