import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect } from "@/lib/admin";
import { DashboardBody } from "./DashboardBody";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await getAdminOrRedirect();
  const now = Date.now();
  const day = 24 * 3600 * 1000;

  const [
    users, usersToday, usersWeek, usersMonth, onlineNow,
    projects, chats, messages, aiJobs,
    proSubs, freeUsers, bannedUsers, aiErrors,
    recentMessages, recentUsersRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: new Date(now - day) } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(now - 7 * day) } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(now - 30 * day) } } }),
    prisma.session.count({ where: { createdAt: { gte: new Date(now - 30 * 60 * 1000) } } }),
    prisma.project.count(),
    prisma.chat.count(),
    prisma.message.count(),
    prisma.aIJob.count(),
    prisma.subscription.count({ where: { plan: { in: ["PRO", "TEAM"] }, status: "ACTIVE" } }),
    prisma.user.count({ where: { subscriptions: { none: { status: "ACTIVE", plan: { in: ["PRO", "TEAM"] } } } } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.aIJob.count({ where: { status: "FAILED" } }),
    prisma.message.findMany({ where: { createdAt: { gte: new Date(now - 30 * day) }, role: "USER" }, select: { createdAt: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true, name: true, email: true, banned: true, createdAt: true,
        _count: { select: { messages: true } },
        subscriptions: { where: { status: "ACTIVE" }, take: 1, select: { plan: true } },
      },
    }),
  ]);

  const activity = new Map<string, number>();
  for (let i = 29; i >= 0; i--) activity.set(new Date(now - i * day).toISOString().slice(0, 10), 0);
  for (const m of recentMessages) {
    const d = m.createdAt.toISOString().slice(0, 10);
    if (activity.has(d)) activity.set(d, (activity.get(d) ?? 0) + 1);
  }
  const series = [...activity.entries()].map(([d, count]) => ({ day: d, count }));

  const PRO_PRICE = 19;
  const data = {
    adminGreetingHour: new Date().getHours(),
    metrics: {
      users, usersToday, usersWeek, usersMonth, onlineNow,
      projects, chats, messages, aiJobs,
      pro: proSubs, free: freeUsers, banned: bannedUsers, aiErrors,
      mrr: proSubs * PRO_PRICE,
    },
    series,
    recentUsers: recentUsersRows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      banned: u.banned,
      messages: u._count.messages,
      plan: u.subscriptions[0]?.plan ?? "FREE",
      joined: u.createdAt.toISOString(),
    })),
  };

  return <DashboardBody data={data} />;
}
