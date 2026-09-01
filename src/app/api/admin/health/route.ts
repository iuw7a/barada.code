import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { checkHealth } from "@/lib/adminHealth";
import { apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await checkHealth());
  } catch (err) {
    return apiErrorResponse(err);
  }
}
