import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePerm, requireSuperAdmin, audit } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** Known permission catalog — the mobile role editor enumerates these. */
const PERMISSIONS: Record<string, string[]> = {
  Users: ["users.view", "users.suspend", "users.pro", "users.sessions", "users.resetUsage"],
  Projects: ["projects.view", "projects.delete"],
  AI: ["ai.view", "ai.manage"],
  Messages: ["messages.view"],
  API: ["api.view"],
  Analytics: ["analytics.view"],
  System: ["system.view"],
  Security: ["security.view", "security.logs"],
  Settings: ["settings.manage"],
  Roles: ["roles.view"],
  Audit: ["audit.view"],
};

/** GET /api/admin/roles — all roles with user counts. Requires roles.view. */
export async function GET() {
  try {
    await requirePerm("roles.view");
    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, description: true, permissions: true, isSystem: true, createdAt: true, _count: { select: { users: true } } },
    });
    return NextResponse.json({ roles, catalog: PERMISSIONS });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const CreateBody = z.object({
  name: z.string().min(2).max(40),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).max(64),
});

/** POST /api/admin/roles — create a custom role. SUPER_ADMIN only. */
export async function POST(req: Request) {
  try {
    const admin = await requireSuperAdmin();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid role data");
    const { name, description, permissions } = parsed.data;
    const exists = await prisma.role.findUnique({ where: { name } });
    if (exists) throw new ApiError(400, "A role with this name already exists");
    const role = await prisma.role.create({ data: { name, description: description ?? "", permissions } });
    await audit(admin.id, "role.created", name, { permissions });
    return NextResponse.json({ role }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
