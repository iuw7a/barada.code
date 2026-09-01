import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSuperAdmin, audit } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const PatchBody = z.object({
  plan: z.enum(["FREE", "PRO", "TEAM"]).optional(),
  banned: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
  resetUsage: z.boolean().optional(),
  revokeSessions: z.boolean().optional(),
});

async function targetOr404(id: string) {
  const t = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
  if (!t) throw new ApiError(404, "User not found");
  return t;
}

/** GET /api/admin/users/[id] — full detail for the user control page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true, banned: true, createdAt: true,
        _count: { select: { projects: true, chats: true, messages: true, sessions: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, select: { id: true, plan: true, status: true, createdAt: true, currentPeriodEnd: true } },
        sessions: { orderBy: { createdAt: "desc" }, take: 5, select: { createdAt: true, expiresAt: true } },
        chats: { orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, updatedAt: true } },
      },
    });
    if (!u) throw new ApiError(404, "User not found");
    const month = new Date().toISOString().slice(0, 7);
    const usage = await prisma.usage.findUnique({ where: { userId_month: { userId: id, month } } });
    const storage = await prisma.projectFile.aggregate({ where: { project: { ownerId: id } }, _sum: { size: true } });
    return NextResponse.json({
      user: {
        id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, role: u.role, banned: u.banned,
        createdAt: u.createdAt,
        counts: { projects: u._count.projects, chats: u._count.chats, messages: u._count.messages, sessions: u._count.sessions },
        plan: u.subscriptions.find((s) => s.status === "ACTIVE")?.plan ?? "FREE",
        subscriptions: u.subscriptions,
        recentSessions: u.sessions, recentChats: u.chats,
        monthUsage: { aiCalls: usage?.aiCalls ?? 0, aiTokens: usage?.aiTokens ?? 0 },
        storageBytes: storage._sum.size ?? 0,
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** PATCH /api/admin/users/[id] — all admin user actions. Audited. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const target = await targetOr404(id);
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    const { plan, banned, role, resetUsage, revokeSessions } = parsed.data;

    if ((banned === true) && target.id === admin.id) throw new ApiError(400, "You cannot suspend your own account");
    if (role && admin.role !== "SUPER_ADMIN") throw new ApiError(403, "Only SUPER_ADMIN can change roles");
    if (role && target.id === admin.id && role !== "SUPER_ADMIN") throw new ApiError(400, "You cannot demote your own account");

    if (plan) {
      const sub = await prisma.subscription.findFirst({ where: { userId: id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
      if (sub) {
        if (plan === "FREE") await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
        else await prisma.subscription.update({ where: { id: sub.id }, data: { plan, currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } });
      } else if (plan !== "FREE") {
        await prisma.subscription.create({ data: { userId: id, plan, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } });
      }
      await audit(admin.id, plan === "FREE" ? "pro.removed" : "pro.granted", target.email, { plan });
    }

    if (banned !== undefined) {
      await prisma.user.update({ where: { id }, data: { banned } });
      if (banned) await prisma.session.deleteMany({ where: { userId: id } });
      await audit(admin.id, banned ? "user.suspended" : "user.unsuspended", target.email);
    }

    if (role) {
      await prisma.user.update({ where: { id }, data: { role, isAdmin: role !== "USER" } });
      await audit(admin.id, "user.role_changed", target.email, { role });
    }

    if (revokeSessions) {
      await prisma.session.deleteMany({ where: { userId: id } });
      await audit(admin.id, "user.sessions_revoked", target.email);
    }

    if (resetUsage) {
      const month = new Date().toISOString().slice(0, 7);
      await prisma.usage.upsert({
        where: { userId_month: { userId: id, month } },
        update: { aiCalls: 0, aiTokens: 0 },
        create: { userId: id, month },
      });
      await audit(admin.id, "user.usage_reset", target.email);
    }

    const fresh = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, banned: true, role: true, subscriptions: { where: { status: "ACTIVE" }, select: { plan: true } } },
    });
    return NextResponse.json({ user: { ...fresh, plan: fresh?.subscriptions[0]?.plan ?? "FREE" } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

/** DELETE /api/admin/users/[id] — account deletion. SUPER_ADMIN only, audited. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin();
    const { id } = await params;
    const target = await targetOr404(id);
    if (target.id === admin.id) throw new ApiError(400, "You cannot delete your own account");
    await prisma.user.delete({ where: { id } });
    await audit(admin.id, "user.deleted", target.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
