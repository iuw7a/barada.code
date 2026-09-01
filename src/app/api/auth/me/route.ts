import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/auth/guard";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });

    const personal = await prisma.workspace.findFirst({
      where: { ownerId: user.id, isPersonal: true },
      select: { id: true, name: true },
    });
    return NextResponse.json({ user, personalWorkspace: personal });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
