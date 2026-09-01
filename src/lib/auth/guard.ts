import { getSessionUser, type AuthUser } from "./session";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Throws ApiError(401) when not logged in. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "请先登录");
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
