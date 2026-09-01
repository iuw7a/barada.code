import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/auth/guard";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
