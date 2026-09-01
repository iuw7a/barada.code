import { getSessionUser, type AuthUser } from "./session";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Throws ApiError(401) when not logged in, 403 when banned. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "请先登录");
  const row = await (await import("@/lib/prisma")).prisma.user.findUnique({
    where: { id: user.id },
    select: { banned: true },
  });
  if (row?.banned) throw new ApiError(403, "This account has been suspended.");
  return user;
}

/** Throws unless the signed-in user has an admin role. */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  const row = await (await import("@/lib/prisma")).prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, isAdmin: true },
  });
  const ok = row?.role === "ADMIN" || row?.role === "SUPER_ADMIN" || row?.isAdmin === true;
  if (!ok) throw new ApiError(404, "Not found");
  return user;
}

/** Uniform error response for API routes. */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] unexpected error:", err);
  return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
}
