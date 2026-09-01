import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, audit } from "@/lib/admin";
import { apiErrorResponse, ApiError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** GET /api/admin/users — server-side search/filter/sort/pagination. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const filter = url.searchParams.get("filter") ?? "all"; // all | banned | pro | admins
    const sort = url.searchParams.get("sort") ?? "createdAt";
    const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));

    const where = {
      AND: [
        q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }] } : {},
        filter === "banned" ? { banned: true } : {},
        filter === "pro" ? { subscriptions: { some: { status: "ACTIVE", plan: { in: ["PRO", "TEAM"] } } } } : {},
        filter === "admins" ? { role: { in: ["ADMIN", "SUPER_ADMIN"] } } : {},
      ],
    };

    const orderBy: Record<string, "asc" | "desc"> =
      sort === "name" ? { name: dir } : sort === "email" ? { email: dir } : { createdAt: dir };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, email: true, name: true, role: true, banned: true, createdAt: true,
          _count: { select: { projects: true, chats: true, messages: true } },
          subscriptions: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1, select: { plan: true } },
          sessions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      users: users.map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role, banned: u.banned, createdAt: u.createdAt,
        projects: u._count.projects, chats: u._count.chats, messages: u._count.messages,
        plan: u.subscriptions[0]?.plan ?? "FREE",
        lastSeenAt: u.sessions[0]?.createdAt ?? null,
      })),
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

const BulkBody = z.object({
  ids: z.array(z.string()).min(1).max(100),
  action: z.enum(["grantPro", "removePro", "ban", "unban", "revokeSessions", "resetUsage"]),
});

/** POST /api/admin/users — bulk actions with audit logging. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = BulkBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "Invalid input");
    const { ids, action } = parsed.data;

    let count = 0;
    for (const id of ids) {
      if (id === admin.id && (action === "ban")) continue; // never ban yourself
      const sub = await prisma.subscription.findFirst({ where: { userId: id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
      if (action === "grantPro") {
        if (sub) await prisma.subscription.update({ where: { id: sub.id }, data: { plan: "PRO", currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } });
        else await prisma.subscription.create({ data: { userId: id, plan: "PRO", status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 864e5) } });
      } else if (action === "removePro" && sub) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
      } else if (action === "ban") {
        await prisma.user.update({ where: { id }, data: { banned: true } });
        await prisma.session.deleteMany({ where: { userId: id } });
      } else if (action === "unban") {
        await prisma.user.update({ where: { id }, data: { banned: false } });
      } else if (action === "revokeSessions") {
        await prisma.session.deleteMany({ where: { userId: id } });
      } else if (action === "resetUsage") {
        const month = new Date().toISOString().slice(0, 7);
        await prisma.usage.upsert({
          where: { userId_month: { userId: id, month } },
          update: { aiCalls: 0, aiTokens: 0 },
          create: { userId: id, month, aiCalls: 0, aiTokens: 0 },
        });
      }
      count++;
    }
    await audit(admin.id, `users.bulk.${action}`, ids.join(","), { count });
    return NextResponse.json({ ok: true, affected: count });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
