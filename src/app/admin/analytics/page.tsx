import { prisma } from "@/lib/prisma";
import { getAdminOrRedirect } from "@/lib/admin";
import { RangeChart, StatGrid } from "../components";

export const dynamic = "force-dynamic";

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await getAdminOrRedirect();
  const { range = "30d" } = await searchParams;
  const days = RANGES[range] ?? 30;
  const since = new Date(Date.now() - days * 864e5);

  const [msgs, usersByDay, aiJobs, totalUsers, totalMsgs, totalChats, totalProjects, aiErrors, proCount] = await Promise.all([
    prisma.message.findMany({ where: { createdAt: { gte: since }, role: "USER" }, select: { createdAt: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.aIJob.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    prisma.user.count(),
    prisma.message.count(),
    prisma.chat.count(),
    prisma.project.count(),
    prisma.aIJob.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.subscription.count({ where: { plan: { in: ["PRO", "TEAM"] }, status: "ACTIVE" } }),
  ]);

  const build = (rows: Date[]) => {
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) map.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), 0);
    for (const d of rows) { const k = d.toISOString().slice(0, 10); if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1); }
    return [...map.entries()].map(([d, v]) => ({ day: d.slice(5), count: v }));
  };

  const aiTotal = aiJobs.reduce((a, j) => a + j._count._all, 0);
  const aiOk = aiJobs.find((j) => j.status === "COMPLETED")?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Analytics</h1>
          <p className="mt-0.5 text-xs text-zinc-500">Real data — every number from the live database.</p>
        </div>
        <div className="ml-auto flex gap-1.5">
          {Object.keys(RANGES).map((r) => (
            <a key={r} href={`/admin/analytics?range=${r}`}
              className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                r === range ? "bg-emerald-500/15 font-semibold text-emerald-300 ring-1 ring-emerald-500/25" : "border border-white/10 text-zinc-400 hover:text-zinc-200"
              }`}>{r.toUpperCase()}</a>
          ))}
        </div>
      </div>

      <StatGrid stats={[
        { label: "Total users", value: String(totalUsers) },
        { label: "New users (range)", value: String(usersByDay.length) },
        { label: "Conversations", value: String(totalChats) },
        { label: "Messages", value: String(totalMsgs) },
        { label: "Projects", value: String(totalProjects) },
        { label: "AI requests (range)", value: String(aiTotal) },
        { label: "AI success rate", value: aiTotal ? `${Math.round((aiOk / aiTotal) * 100)}%` : "—" },
        { label: "AI errors (range)", value: String(aiErrors) },
        { label: "Conversion to PRO", value: totalUsers ? `${((proCount / totalUsers) * 100).toFixed(1)}%` : "—" },
      ]} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-200">New users per day</h2>
          <RangeChart series={build(usersByDay.map((u) => u.createdAt))} />
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-zinc-200">Messages per day</h2>
          <RangeChart series={build(msgs.map((m) => m.createdAt))} />
        </div>
      </div>
    </div>
  );
}
