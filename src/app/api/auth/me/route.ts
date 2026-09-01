import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });

    const personal = await prisma.workspace.findFirst({
      where: { ownerId: user.id, isPersonal: true },
      select: { id: true, name: true },
    });
    // role is informational for the clients (mobile admin console);
    // every admin endpoint enforces it server-side via requireAdmin().
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isAdmin: true },
    });
    const role = row?.role === "ADMIN" || row?.role === "SUPER_ADMIN" ? row.role : row?.isAdmin ? "ADMIN" : "USER";
    return NextResponse.json({ user: { ...user, role }, personalWorkspace: personal });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
