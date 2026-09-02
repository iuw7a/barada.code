import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, audit } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const PatchBody = z.object({
  name: z.string().min(2).max(40).optional(),
  description: z.string().max(200).optional(),
  permissions: z.array(z.string()).max(64).optional(),
});

/** PATCH /api/admin/roles/[id] — edit role permissions. SUPER_ADMIN only. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await params;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) throw new ApiError(404, "Role not found");
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    const updated = await prisma.role.update({ where: { id }, data: parsed.data });
    await audit(admin.id, "role.updated", updated.name, { permissions: updated.permissions });
    return NextResponse.json({ role: updated });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE /api/admin/roles/[id] — delete a custom role. System roles are protected. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await params;
    const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new ApiError(404, "Role not found");
    if (role.isSystem) throw new ApiError(400, "Built-in system roles cannot be deleted");
    if (role._count.users > 0) throw new ApiError(400, `This role still has ${role._count.users} user(s) — reassign them first`);
    await prisma.role.delete({ where: { id } });
    await audit(admin.id, "role.deleted", role.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
